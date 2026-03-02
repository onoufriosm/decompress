import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { getChannelMetadata, getChannelVideos } from "../lib/youtube.js";
import { fetchTranscript } from "../lib/transcript.js";
import { generateSummary } from "../lib/summarize.js";
import { upsertSource, insertVideo } from "../lib/db.js";

const MIN_DURATION_SECONDS = 20 * 60; // 20 minutes
const MAX_VIDEOS = 10;

const payloadSchema = z.object({
  handle: z.string().min(1), // e.g. "@20VC"
});

export const processChannel = task({
  id: "process-channel",
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const { handle } = payloadSchema.parse(payload);

    // Step 1: Fetch channel metadata
    logger.info(`Fetching channel metadata for ${handle}`);
    const channel = await getChannelMetadata(handle);
    logger.info(`Channel: ${channel.name} (${channel.id})`);

    // Step 2: Upsert source in database
    const sourceId = await upsertSource({
      externalId: channel.id,
      handle,
      name: channel.name,
      description: channel.description,
      thumbnailUrl: channel.thumbnailUrl,
      bannerUrl: channel.bannerUrl,
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
    });
    logger.info(`Source upserted with ID: ${sourceId}`);

    // Step 3: List channel videos with full metadata (single batch)
    logger.info("Fetching channel videos with metadata");
    const allVideos = await getChannelVideos(channel.id, 50);
    logger.info(`Found ${allVideos.length} total videos`);

    // Step 4: Filter by duration and take latest 10
    const eligibleVideos = allVideos.filter(
      (v) => v.duration >= MIN_DURATION_SECONDS
    );
    const videosToProcess = eligibleVideos.slice(0, MAX_VIDEOS);
    logger.info(
      `${eligibleVideos.length} videos >= 20 min, processing ${videosToProcess.length}`
    );

    // Step 5: Process each video (transcript + summary + save)
    let processed = 0;
    let transcriptsFound = 0;
    let summariesGenerated = 0;

    for (const video of videosToProcess) {
      try {
        logger.info(
          `[${processed + 1}/${videosToProcess.length}] Processing: ${video.title}`
        );

        // 5a: Fetch transcript
        const transcript = await fetchTranscript(video.id);
        if (transcript) {
          transcriptsFound++;
          logger.info(
            `Transcript: ${transcript.content.length} chars (${transcript.language})`
          );
        } else {
          logger.warn(`No transcript available for: ${video.title}`);
        }

        // 5b: Generate summary if transcript exists
        let summary: string | undefined;
        if (transcript) {
          try {
            summary = await generateSummary(transcript.content, video.title);
            summariesGenerated++;
            logger.info(`Summary generated (${summary.length} chars)`);
          } catch (err) {
            logger.error(`Summary generation failed for ${video.id}: ${err}`);
          }
        }

        // 5c: Insert video into database
        await insertVideo({
          sourceId,
          externalId: video.id,
          url: video.url,
          title: video.title,
          description: video.description,
          durationSeconds: video.duration,
          durationString: video.durationString,
          thumbnailUrl: video.thumbnailUrl,
          uploadDate: video.uploadDate,
          publishedAt: video.publishedAt,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          transcript: transcript?.content,
          transcriptLanguage: transcript?.language,
          summary,
        });

        processed++;
        logger.info(`Video saved: ${video.title}`);
      } catch (err) {
        logger.error(`Failed to process video ${video.id}: ${err}`);
      }
    }

    const result = {
      channel: channel.name,
      handle,
      sourceId,
      totalVideosFound: allVideos.length,
      eligible: eligibleVideos.length,
      processed,
      transcriptsFound,
      summariesGenerated,
    };

    logger.info("Channel processing complete", result);
    return result;
  },
});
