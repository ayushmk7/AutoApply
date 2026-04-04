import type { Job } from 'bullmq';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { config } from '../lib/config.js';
import { getFirestore } from '../lib/firebase.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../lib/httpError.js';
import { listingDocumentRef, userApplicationRef } from '../lib/firestorePaths.js';
import { runApplyPipeline } from '../services/applyPipeline.js';
import { detectAtsTypeFromUrl } from '../services/atsDetect.js';
import { extractListingFromHtml, extractListingFromPlainText } from '../services/extractListingPage.js';
import { emitUserFeed } from '../services/feedEmit.js';
import type { FeedEmitContext } from '../services/feedEmit.js';
import { fetchUrlHtml } from '../services/fetchUrl.js';
import { assertUrlSafeForFetch } from '../services/ssrfGuard.js';
import { normalizeJobUrl } from '../services/urlNormalize.js';
import type { ListingDocument, ListingSource } from '../types/listing.js';
import type { ApplyFromPastedUrlJobData } from './jobTypes.js';

async function listingFeedCtx(db: Firestore, listingId: string): Promise<FeedEmitContext> {
  const s = await listingDocumentRef(db, listingId).get();
  const d = s.data() as ListingDocument | undefined;
  return { company: d?.company ?? '', role: d?.role ?? '' };
}

async function mergeListingFromExtracted(
  db: Firestore,
  listingId: string,
  extracted: {
    title: string;
    company: string | null;
    location: string;
    description: string;
    application_url: string;
    inferred_custom_questions: { prompt: string }[];
    requires_cover_letter: boolean;
    confidence: number;
  },
  source: ListingSource,
  pageUrl: string
): Promise<void> {
  const ref = listingDocumentRef(db, listingId);
  const applyUrl = normalizeJobUrl(extracted.application_url || pageUrl) || pageUrl;
  const payload: Partial<ListingDocument> = {
    company: (extracted.company && extracted.company.trim()) || 'Unknown',
    role: extracted.title?.trim() || 'Role',
    location: extracted.location?.trim() || '',
    description: extracted.description?.trim() || '',
    url: applyUrl,
    source,
    requires_cover_letter: Boolean(extracted.requires_cover_letter),
    custom_questions: extracted.inferred_custom_questions.map((q) => q.prompt),
    parse_confidence: extracted.confidence,
    ats_type: detectAtsTypeFromUrl(applyUrl),
    last_seen: FieldValue.serverTimestamp(),
    active: true,
  };
  await ref.set(payload, { merge: true });
}

export async function processApplyFromPastedUrlJob(
  job: Job<ApplyFromPastedUrlJobData>
): Promise<void> {
  const data = job.data;
  const db = getFirestore();
  const requestId = data.requestId ?? String(job.id);
  const listingRef = listingDocumentRef(db, data.listingId);
  const appRef = userApplicationRef(db, data.uid, data.applicationId);

  const jdText = (data.job_description_text ?? '').trim();
  const rawUrl = (data.url ?? '').trim();
  const normalizedUrl = rawUrl ? normalizeJobUrl(rawUrl) : '';

  try {
    const manualPlaceholderNorm =
      normalizeJobUrl(config.manualPlaceholderJobUrl) || config.manualPlaceholderJobUrl;
    if (normalizedUrl && normalizedUrl !== manualPlaceholderNorm) {
      await emitUserFeed(
        data.uid,
        {
          action: 'fetching_job_page',
          application_id: data.applicationId,
          listing_id: data.listingId,
        },
        requestId,
        await listingFeedCtx(db, data.listingId)
      );

      try {
        await assertUrlSafeForFetch(normalizedUrl);
      } catch (err) {
        if (
          err instanceof HttpError &&
          ['SSRF_BLOCKED', 'INVALID_URL', 'UNSUPPORTED_SCHEME'].includes(err.code)
        ) {
          await appRef.set(
            {
              status: 'manual_needed',
              manual_reason: err.message,
              response_type: err.code,
              updated_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          await emitUserFeed(
            data.uid,
            {
              action: 'error',
              application_id: data.applicationId,
              listing_id: data.listingId,
              code: err.code,
              detail: err.message,
            },
            requestId,
            await listingFeedCtx(db, data.listingId)
          );
          return;
        }
        throw err;
      }

      const fetched = await fetchUrlHtml(normalizedUrl, requestId);

      if (
        fetched.classification === 'login_wall' ||
        fetched.classification === 'rate_limited' ||
        fetched.classification === 'blocked'
      ) {
        if (!jdText) {
          await appRef.set(
            {
              status: 'manual_needed',
              manual_reason: 'Fetch blocked or requires sign-in.',
              response_type: 'FETCH_BLOCKED',
              updated_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          await emitUserFeed(
            data.uid,
            {
              action: 'manual_needed',
              application_id: data.applicationId,
              listing_id: data.listingId,
              code: 'FETCH_BLOCKED',
              next_step: 'paste_jd',
              detail: 'Provide job description text to continue.',
            },
            requestId,
            await listingFeedCtx(db, data.listingId)
          );
          return;
        }
        const extracted = await extractListingFromPlainText(jdText, normalizedUrl, requestId);
        await mergeListingFromExtracted(db, data.listingId, extracted, 'manual_paste', normalizedUrl);
      } else if (fetched.html?.trim()) {
        await emitUserFeed(
          data.uid,
          {
            action: 'extracting_listing',
            application_id: data.applicationId,
            listing_id: data.listingId,
          },
          requestId,
          await listingFeedCtx(db, data.listingId)
        );
        let extracted = await extractListingFromHtml(fetched.html, fetched.finalUrl, requestId);
        if (extracted.confidence < config.extractionConfidenceThreshold && jdText) {
          extracted = await extractListingFromPlainText(jdText, fetched.finalUrl, requestId);
        } else if (extracted.confidence < config.extractionConfidenceThreshold && !jdText) {
          await appRef.set(
            {
              status: 'manual_needed',
              manual_reason: 'Listing extraction confidence is low.',
              response_type: 'EXTRACTION_LOW_CONFIDENCE',
              updated_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          await emitUserFeed(
            data.uid,
            {
              action: 'manual_needed',
              application_id: data.applicationId,
              listing_id: data.listingId,
              code: 'EXTRACTION_LOW_CONFIDENCE',
              next_step: 'paste_jd',
            },
            requestId,
            await listingFeedCtx(db, data.listingId)
          );
          return;
        }
        await mergeListingFromExtracted(
          db,
          data.listingId,
          extracted,
          'user_url',
          fetched.finalUrl
        );
      } else if (jdText) {
        const extracted = await extractListingFromPlainText(jdText, normalizedUrl, requestId);
        await mergeListingFromExtracted(db, data.listingId, extracted, 'manual_paste', normalizedUrl);
      } else {
        await appRef.set(
          {
            status: 'manual_needed',
            manual_reason: 'Could not download a usable HTML page.',
            response_type: 'FETCH_BLOCKED',
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await emitUserFeed(
          data.uid,
          {
            action: 'manual_needed',
            application_id: data.applicationId,
            listing_id: data.listingId,
            code: 'FETCH_BLOCKED',
            next_step: 'paste_jd',
          },
          requestId,
          await listingFeedCtx(db, data.listingId)
        );
        return;
      }
    } else if (jdText) {
      const extracted = await extractListingFromPlainText(
        jdText,
        config.manualPlaceholderJobUrl,
        requestId
      );
      await mergeListingFromExtracted(
        db,
        data.listingId,
        extracted,
        'manual_paste',
        extracted.application_url || config.manualPlaceholderJobUrl
      );
    }

    const listSnap = await listingRef.get();
    const desc = ((listSnap.data() as ListingDocument | undefined)?.description ?? '').trim();
    if (!desc) {
      await appRef.set(
        {
          status: 'manual_needed',
          manual_reason: 'No job description available.',
          response_type: 'EXTRACTION_LOW_CONFIDENCE',
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await emitUserFeed(
        data.uid,
        {
          action: 'manual_needed',
          application_id: data.applicationId,
          listing_id: data.listingId,
          code: 'EXTRACTION_LOW_CONFIDENCE',
          next_step: 'paste_jd',
        },
        requestId,
        await listingFeedCtx(db, data.listingId)
      );
      return;
    }

    await appRef.set({ status: 'queued', updated_at: FieldValue.serverTimestamp() }, { merge: true });

    await runApplyPipeline({
      db,
      uid: data.uid,
      applicationId: data.applicationId,
      listingId: data.listingId,
      requestId,
      forceManualSubmit: data.force_manual_submit,
    });
  } catch (err) {
    logger.error({ err, requestId, jobId: job.id }, 'apply_from_url_job_failed');
    await appRef.set(
      {
        status: 'manual_needed',
        manual_reason: 'Failed to process pasted URL intake.',
        response_type: 'MANUAL_COMPLETION_REQUIRED',
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await emitUserFeed(
      data.uid,
      {
        action: 'error',
        application_id: data.applicationId,
        listing_id: data.listingId,
        detail: 'apply_from_url_failed',
      },
      requestId,
      await listingFeedCtx(db, data.listingId)
    );
  }
}
