// The lucide icons Okwu uses, imported one file each. The
// "lucide-react-native" barrel re-exports ~1,800 icons and, without tree
// shaking, Metro bundles and runs every one at the first import (a cold-start
// cost Vela measured). Import icons from here; scripts/lint-ui.mjs bans the
// barrel in screens and feature components.
// To add one: its kebab-case file is lucide-react-native/icons/<name>.
import type React from "react";

export type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as ArrowRight } from "lucide-react-native/icons/arrow-right";
export { default as AudioLines } from "lucide-react-native/icons/audio-lines";
export { default as Bell } from "lucide-react-native/icons/bell";
export { default as BookOpen } from "lucide-react-native/icons/book-open";
export { default as CalendarDays } from "lucide-react-native/icons/calendar-days";
export { default as Check } from "lucide-react-native/icons/check";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as CircleAlert } from "lucide-react-native/icons/circle-alert";
export { default as CircleCheck } from "lucide-react-native/icons/circle-check";
export { default as CircleUser } from "lucide-react-native/icons/circle-user-round";
export { default as Delete } from "lucide-react-native/icons/delete";
export { default as Ear } from "lucide-react-native/icons/ear";
export { default as Flag } from "lucide-react-native/icons/flag";
export { default as Headphones } from "lucide-react-native/icons/headphones";
export { default as HeartHandshake } from "lucide-react-native/icons/heart-handshake";
export { default as Info } from "lucide-react-native/icons/info";
export { default as Keyboard } from "lucide-react-native/icons/keyboard";
export { default as Languages } from "lucide-react-native/icons/languages";
export { default as Layers } from "lucide-react-native/icons/layers";
export { default as Lock } from "lucide-react-native/icons/lock";
export { default as MessageCircle } from "lucide-react-native/icons/message-circle";
export { default as Mic } from "lucide-react-native/icons/mic";
export { default as Minus } from "lucide-react-native/icons/minus";
export { default as Play } from "lucide-react-native/icons/play";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as Repeat } from "lucide-react-native/icons/repeat";
export { default as RotateCcw } from "lucide-react-native/icons/rotate-ccw";
export { default as Search } from "lucide-react-native/icons/search";
export { default as Settings } from "lucide-react-native/icons/settings";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";
export { default as Sparkles } from "lucide-react-native/icons/sparkles";
export { default as Sprout } from "lucide-react-native/icons/sprout";
export { default as TriangleAlert } from "lucide-react-native/icons/triangle-alert";
export { default as UserPlus } from "lucide-react-native/icons/user-plus";
export { default as Users } from "lucide-react-native/icons/users";
export { default as Volume2 } from "lucide-react-native/icons/volume-2";
export { default as X } from "lucide-react-native/icons/x";
// Community, Me, Settings and Plus (screens D3).
export { default as Ban } from "lucide-react-native/icons/ban";
export { default as Clock } from "lucide-react-native/icons/clock";
export { default as Copy } from "lucide-react-native/icons/copy";
export { default as Download } from "lucide-react-native/icons/download";
export { default as Ellipsis } from "lucide-react-native/icons/ellipsis";
export { default as ExternalLink } from "lucide-react-native/icons/external-link";
export { default as FileText } from "lucide-react-native/icons/file-text";
export { default as Hourglass } from "lucide-react-native/icons/hourglass";
export { default as LifeBuoy } from "lucide-react-native/icons/life-buoy";
export { default as LogOut } from "lucide-react-native/icons/log-out";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as Pause } from "lucide-react-native/icons/pause";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as Scale } from "lucide-react-native/icons/scale";
export { default as Send } from "lucide-react-native/icons/send";
export { default as Share2 } from "lucide-react-native/icons/share-2";
export { default as ShieldOff } from "lucide-react-native/icons/shield-off";
export { default as Square } from "lucide-react-native/icons/square";
export { default as Star } from "lucide-react-native/icons/star";
export { default as Trash } from "lucide-react-native/icons/trash";
export { default as UserX } from "lucide-react-native/icons/user-x";
export { default as VolumeX } from "lucide-react-native/icons/volume-x";
export { default as WifiOff } from "lucide-react-native/icons/wifi-off";
// Learner tools: flashcards, offline packs and the progress report (E4).
export { default as BookmarkPlus } from "lucide-react-native/icons/bookmark-plus";
export { default as ChartColumn } from "lucide-react-native/icons/chart-column";
export { default as GalleryVerticalEnd } from "lucide-react-native/icons/gallery-vertical-end";
export { default as HardDrive } from "lucide-react-native/icons/hard-drive";
export { default as Wifi } from "lucide-react-native/icons/wifi";
// Phrasebook situations and real-life conversations (E3).
export { default as Baby } from "lucide-react-native/icons/baby";
export { default as Church } from "lucide-react-native/icons/church";
export { default as CookingPot } from "lucide-react-native/icons/cooking-pot";
export { default as DoorOpen } from "lucide-react-native/icons/door-open";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as Heart } from "lucide-react-native/icons/heart";
export { default as House } from "lucide-react-native/icons/house";
export { default as MessagesSquare } from "lucide-react-native/icons/messages-square";
export { default as PartyPopper } from "lucide-react-native/icons/party-popper";
export { default as Phone } from "lucide-react-native/icons/phone";
export { default as ShoppingBasket } from "lucide-react-native/icons/shopping-basket";
export { default as Signpost } from "lucide-react-native/icons/signpost";
export { default as Siren } from "lucide-react-native/icons/siren";
export { default as SkipForward } from "lucide-react-native/icons/skip-forward";
export { default as Stethoscope } from "lucide-react-native/icons/stethoscope";
