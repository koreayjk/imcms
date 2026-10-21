// English names for the five homepage layouts (international pages). Keys match lib/home-layouts.ts
import type { HomeLayout } from './home-layouts'

export const LAYOUTS_EN: { key: HomeLayout; name: string; label: string; features: string; fit: string }[] = [
  { key: 'editorial', name: 'Editorial', label: 'Classic newspaper', features: 'A centered masthead, thin rules and serif headlines. The look of a traditional paper.', fit: 'Politics, analysis and association publications' },
  { key: 'cards', name: 'Magazine', label: 'Cards and a big hero', features: 'A large hero photo with rounded story cards and generous whitespace. Reads well on phones.', fit: 'Local, multilingual and mobile-first audiences' },
  { key: 'standard', name: 'Three-column', label: 'Front page', features: 'Sub-stories on the left, the lead headline in the center, a live feed on the right, then top stories and most-read.', fit: 'General news with many daily stories' },
  { key: 'portal', name: 'Portal', label: 'Headline list', features: 'One big lead plus a dense headline list and a breaking-news strip. Shows many headlines at once.', fit: 'High-volume news desks' },
  { key: 'bands', name: 'Section bands', label: 'Sections stacked', features: 'Horizontal section bands under the lead (brief, large-story and four-photo styles).', fit: 'Specialty publications with clear beats' },
]
