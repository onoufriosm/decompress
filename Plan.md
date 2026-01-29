# Decompress - Feature Plan

## Current State

### Fully Implemented

#### Content Management
- **Video Scraping** - Python scraper using yt-dlp for YouTube channels
- **Transcript Extraction** - Via Supadata API with language detection
- **Metadata Enrichment** - Duration, publication date, thumbnails, engagement metrics
- **People Tracking** - Hosts and guests with roles (host, guest, co-host, interviewer)

#### Content Discovery & Browsing
- **Videos Page** - Search, category filtering, metadata display, guest info
- **Channels Page** - Browse channels with subscriber counts, category filtering
- **People Page** - Directory of hosts/guests with appearance counts
- **Video Detail View** - Full metadata, transcript display, summary tab, people section

#### Channel Subscriptions
- **Favorite Channels** - Users can star/favorite channels
- **Notifications** - Real-time alerts for new videos from favorited channels
- **Home Dashboard** - Shows favorites and new videos since last visit

#### AI Chat
- **Persistent Chat Threads** - Create, rename, delete conversations
- **Multi-Video Context** - Add multiple videos to a chat session
- **Streaming Responses** - Real-time AI responses using Vercel AI SDK
- **Multiple LLM Providers** - Anthropic Claude, OpenAI GPT, Google Gemini
- **Query Limiting** - 200 queries/month, $4 budget cap

#### Authentication & Payments
- **Passwordless Auth** - OTP email login via Supabase
- **Stripe Subscriptions** - $9.99/month with webhook handling
- **Usage Tracking** - Token costs and query counts

#### Search & Filtering
- **Full-Text Search** - Fuzzy search with PostgreSQL trigram indexes
- **Category Filtering** - Hierarchical categories for videos and channels

### Partially Implemented

#### Video Summaries
- Database column exists (`videos.summary`, `summary_generated_at`)
- UI displays summaries when available
- Full summarization module exists in `packages/scraper/src/scraper/summarize.py`
- **Missing**: Scheduled job to run automatically (currently CLI-only)

#### People Extraction
- Schema supports automatic extraction
- Migration added for the feature
- **Missing**: Integration with main scraping workflow

---

## Phase 1: Core Value Delivery - Detailed Status

### 1. Automatic Summary Generation

#### What Exists
| Component | Status | Location |
|-----------|--------|----------|
| AI Provider Integration | ✅ Done | `packages/scraper/src/scraper/summarize.py` |
| OpenAI (GPT-4o-mini) | ✅ Done | `generate_summary_openai()` |
| Anthropic (Claude Sonnet) | ✅ Done | `generate_summary_anthropic()` |
| Batch Processing | ✅ Done | `summarize_videos()` with stats |
| Database Schema | ✅ Done | `summary` and `summary_generated_at` columns |
| Notification Trigger | ✅ Done | `notify_favorited_channel_new_summary()` |
| CLI Entry Point | ✅ Done | `python -m scraper.summarize` |

#### What's Missing
| Component | Status | Effort |
|-----------|--------|--------|
| Scheduled Job/Cron | ❌ Missing | **Low** |
| API Endpoint to Trigger | ❌ Missing | Low |
| Integration with Scraping Pipeline | ❌ Missing | Low |

**Effort to Complete: LOW** - Just need to add scheduling (cron job, GitHub Actions, or cloud scheduler)

---

### 2. Daily/Weekly Digest

#### What Exists
| Component | Status | Location |
|-----------|--------|----------|
| Notifications Table | ✅ Done | `notifications` table with `new_video`, `new_summary` types |
| New Videos Query | ✅ Done | `get_new_videos_since_last_visit(user_id)` function |
| In-App Notifications | ✅ Done | Real-time via Supabase Realtime |
| Notifications Hook | ✅ Done | `packages/web/src/lib/use-notifications.ts` |

#### What's Missing
| Component | Status | Effort |
|-----------|--------|--------|
| Email Service Integration | ❌ Missing | Medium |
| User Preferences Table | ❌ Missing | Low |
| Digest Generation Function | ❌ Missing | Medium |
| Email Templates | ❌ Missing | Medium |
| Scheduled Digest Jobs | ❌ Missing | Low |
| Settings UI for Preferences | ❌ Missing | Medium |
| Unsubscribe Management | ❌ Missing | Low |

**Effort to Complete: MEDIUM-HIGH** - Requires email infrastructure, templates, preferences, and scheduling

---

### 3. Cross-Video Research Mode

#### What Exists
| Component | Status | Location |
|-----------|--------|----------|
| Multi-Video Chat Context | ✅ Done | Chat supports selecting multiple videos |
| Transcript Fetching | ✅ Done | Auto-fetches transcripts for selected videos |
| Streaming AI Responses | ✅ Done | Vercel AI SDK integration |
| Chat Thread Management | ✅ Done | Persistent threads with video associations |

#### What's Missing (for "true" research mode)
| Component | Status | Effort |
|-----------|--------|--------|
| Auto-Search All Transcripts | ❌ Missing | High |
| Semantic Search/Embeddings | ❌ Missing | High |
| Source Citations in Responses | ❌ Missing | Medium |

**Current Status: FUNCTIONAL** - Users can already select multiple videos and query across them. The "research mode" as originally conceived is essentially implemented. Advanced features (semantic search, auto-inclusion) are nice-to-have.

---

## Phase 1 Implementation Priority

| Feature | Current State | Effort to Complete | Priority |
|---------|---------------|-------------------|----------|
| Auto Summary Generation | 90% done | **Low** (add cron) | 🔴 Do First |
| Summary on Video Cards | Partial | **Low** (UI change) | 🔴 Do First |
| Daily/Weekly Digest | 20% done | **Medium-High** | 🟡 Do Second |
| Cross-Video Research | ✅ Functional | Optional enhancements | 🟢 Done (MVP) |

---

## Features to Add

### Phase 2: Enhanced Experience

#### 4. Video Chapters & Timestamps
**Priority: MEDIUM**

Better navigation within long videos.

- Extract chapter markers from YouTube (already have `video_chapters` table)
- Generate AI chapters for videos without native chapters
- Jump-to-timestamp links in summaries and chat responses
- Chapter-based navigation in transcript view

#### 5. Topic/Theme Extraction
**Priority: MEDIUM**

Automatically identify and tag topics discussed.

- Extract key topics/themes from each video using AI
- Create topic taxonomy across all content
- Enable filtering by topic
- Show topic trends over time
- "More on this topic" recommendations

#### 6. Guest/Host Insights
**Priority: MEDIUM**

Better tracking of recurring guests and their topics.

- Show all appearances by a person with topic summaries
- "What does [person] think about [topic]" queries
- Detect when same person appears on multiple channels
- Track evolution of their views over time

### Phase 2: Enhanced Experience

#### 4. Video Chapters & Timestamps
**Priority: MEDIUM**

Better navigation within long videos.

- Extract chapter markers from YouTube (already have `video_chapters` table)
- Generate AI chapters for videos without native chapters
- Jump-to-timestamp links in summaries and chat responses
- Chapter-based navigation in transcript view

#### 5. Topic/Theme Extraction
**Priority: MEDIUM**

Automatically identify and tag topics discussed.

- Extract key topics/themes from each video using AI
- Create topic taxonomy across all content
- Enable filtering by topic
- Show topic trends over time
- "More on this topic" recommendations

#### 6. Guest/Host Insights
**Priority: MEDIUM**

Better tracking of recurring guests and their topics.

- Show all appearances by a person with topic summaries
- "What does [person] think about [topic]" queries
- Detect when same person appears on multiple channels
- Track evolution of their views over time

### Phase 3: Smart Features

#### 7. Deduplication & Overlap Detection
**Priority: HIGH (for differentiation)**

The killer feature - detect redundant content.

- When same guest appears on multiple podcasts:
  - Compare topics discussed
  - Highlight only NEW points not covered before
  - Option to skip video entirely if >80% overlap
- Show "overlap score" on videos
- "Already covered in [other video]" badges
- Differential summaries: "New compared to previous appearance"

#### 8. Personalized Relevance Scoring
**Priority: MEDIUM**

Learn what matters to each user.

- Track which summaries user reads fully vs skips
- Track which topics user chats about
- Score new videos by predicted relevance
- Surface most relevant content first
- "Because you're interested in [topic]" sections

#### 9. Smart Notifications
**Priority: MEDIUM**

Don't notify for everything.

- Only notify for videos likely to interest user
- Batch low-priority notifications into digest
- Instant notification for high-relevance content
- "This guest you follow appeared on new channel" alerts

### Phase 4: Power Features

#### 10. Saved Clips & Notes
**Priority: LOW**

Let users save important moments.

- Highlight/save transcript sections
- Add personal notes to videos
- Create collections of related clips
- Export notes/highlights

#### 11. Podcast Feed Integration
**Priority: MEDIUM**

Support beyond YouTube.

- Add RSS feed support for podcasts
- Spotify podcast integration
- Apple Podcasts integration
- Unified experience across platforms

#### 12. Mobile App
**Priority: LOW**

Native mobile experience.

- Audio playback of summaries (TTS)
- Listen to digests while commuting
- Quick save for later
- Push notifications

#### 13. Team/Shared Libraries
**Priority: LOW**

For teams that research together.

- Shared channel subscriptions
- Collaborative annotations
- Team chat threads
- Shared collections

---

## Technical Improvements

### Performance
- [ ] Add Redis caching for frequent queries
- [ ] Implement pagination for large result sets
- [ ] Add background job queue (Inngest, Trigger.dev) for heavy processing

### Search
- [ ] Add vector embeddings for semantic search (pgvector)
- [ ] Implement hybrid search (keyword + semantic)
- [ ] Add search within transcripts with highlighting

### Infrastructure
- [ ] Set up proper job scheduler for scraping
- [ ] Add monitoring and alerting
- [ ] Implement proper error tracking (Sentry)
- [ ] Add analytics for user behavior

### Data Quality
- [ ] Improve people extraction accuracy
- [ ] Add duplicate video detection
- [ ] Handle video updates (re-uploads, edits)

---

## Implementation Priority

### Now (Next Sprint)
1. Automatic Summary Generation
2. Daily/Weekly Digest emails
3. Improve summary display on video cards

### Soon (Next Month)
4. Cross-Video Research Mode
5. Deduplication Detection (MVP)
6. Topic Extraction

### Later (Next Quarter)
7. Personalized Relevance Scoring
8. Smart Notifications
9. Podcast Feed Integration
10. Saved Clips & Notes

### Future
11. Mobile App
12. Team Features
13. Advanced Analytics Dashboard

---

## Success Metrics

- **Time Saved**: Hours of content → Minutes of reading
- **Coverage**: % of subscribed content user actually consumes (via summaries)
- **Engagement**: Chat queries per user per week
- **Retention**: Weekly active users
- **NPS**: User satisfaction with summaries quality
- **Deduplication Value**: % of content flagged as redundant that user skips
