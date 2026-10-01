'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  CalendarDays,
  Table as TableIcon,
  Route as RouteIcon,
  List as ListIcon,
  Settings,
  MapPin,
  Download,
  Share2,
  X,
  Navigation,
  Dice5,
} from 'lucide-react';
import { addDays, daysBetween, todayStr, MAX_TRIP_DAYS } from '@/lib/dates';
import { CategoryPreferenceGroup, type CategorySelection } from '@/components/CategoryPreferenceGroup';
import { SingleChoiceGroup } from '@/components/SingleChoiceGroup';
import { PreferenceTagInput } from '@/components/PreferenceTagInput';
import { PerDayCountsEditor } from '@/components/PerDayCountsEditor';
import { SourceWeightSliders } from '@/components/SourceWeightSliders';
import { RoutePolyline } from '@/components/RoutePolyline';
import { ChatSidebar } from '@/components/ChatSidebar';
import { CalendarView, type CalendarSubView } from '@/components/CalendarView';
import { AddPlaceMenu } from '@/components/AddPlaceMenu';
import { OptionStepper } from '@/components/OptionStepper';
import { MovePanel } from '@/components/MovePanel';
import { OpenInGoogleMaps } from '@/components/OpenInGoogleMaps';
import { TableView } from '@/components/TableView';
import { SpotDetail } from '@/components/SpotDetail';
import { SpotModal } from '@/components/SpotModal';
import { AddPlaceModal } from '@/components/AddPlaceModal';
import { ReverseGeocoder, type ReverseGeocodeResult } from '@/components/ReverseGeocoder';
import { DestinationAutocomplete } from '@/components/DestinationAutocomplete';
import { ImportModal } from '@/components/ImportModal';
import { sourcesForItem } from '@/lib/sources';
import { getSpotEmoji } from '@/lib/spotEmoji';
import { applyTranslation } from '@/lib/domTranslate';
import { exportMapsCsv } from '@/lib/exportMapsCsv';
import { exportIcal } from '@/lib/exportIcal';
import {
  encodeTrip,
  decodeTrip,
  buildShareHash,
  parseShareHash,
  type ShareOptions,
} from '@/lib/shareUrl';
import { useDayRoutes } from '@/lib/useDayRoutes';
import { dayColor } from '@/lib/dayColor';
import { checkBuildLimit, recordBuild, refundBuild, buildLimitMessage } from '@/lib/clientRateLimit';
import { formatDuration, formatDistance, googleMapsDayUrl, type TravelMode } from '@/lib/travel';
import { hoursNoteForItem } from '@/lib/openingHours';
import {
  startItemDrag,
  isItineraryDrag,
  readDraggedIndex,
  dropPosition,
  moveItem,
  type MoveTarget,
  type DropPosition,
} from '@/lib/dragDrop';
import type {
  ChatOp,
  ItineraryItem,
  ItineraryRequest,
  DayCounts,
  PreferenceTag,
  Budget,
  TravelParty,
  Pace,
  Transportation,
  SourceWeights,
  SourceConfig,
} from '@/lib/types';

const MAX_SPOTS = 50;
const DEFAULT_CENTER = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 2;
const SLOT_ORDER: Record<ItineraryItem['slot'], number> = { Morning: 0, Afternoon: 1, Evening: 2 };
const WORLD_BOUNDS = { north: 85, south: -85, west: -180, east: 180 };

const BUDGET_OPTIONS: Budget[] = ['No preference', 'Budget', 'Mid-range', 'Luxury'];
const PARTY_OPTIONS: TravelParty[] = ['No preference', 'Solo', 'Couple', 'Family', 'Friends group'];
const PACE_OPTIONS: Pace[] = ['No preference', 'Relaxed', 'Balanced', 'Packed'];
const TRANSPORT_OPTIONS: Transportation[] = ['No preference', 'Walking / Transit', 'Car'];

// Each language's own name, in its own script, so it's findable regardless of the page's
// current language — the standard convention for a language switcher. Codes double as the
// Google Maps JS API's own `language` param, which localizes the map's native UI directly.
const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-CN', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
];

const DIET_OPTIONS = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Kosher', 'Nut-Free', 'Shellfish-Free'];
const ATTRACTION_OPTIONS = ['Iconic Landmarks', 'Waterparks', 'Family Fun', 'Nightlife', 'Sports', 'Museums & Culture', 'Nature & Outdoors', 'Shopping'];
const FOOD_STYLE_OPTIONS = ['Fine Dining', 'Casual Diner', 'Cafe', 'Street Food', 'Fast Food', 'Local Favorites'];

const DEMO_DESTINATIONS = [
  'Paris, France',
  'Tokyo, Japan',
  'New York City, NY',
  'Rome, Italy',
  'Barcelona, Spain',
  'Halifax, NS, Canada',
  'London, UK',
  'Vancouver, BC, Canada',
  'Lisbon, Portugal',
  'Reykjavik, Iceland',
  'Bangkok, Thailand',
  'Sydney, Australia',
  'Amsterdam, Netherlands',
  'Berlin, Germany',
  'Prague, Czechia',
  'Vienna, Austria',
  'Budapest, Hungary',
  'Copenhagen, Denmark',
  'Stockholm, Sweden',
  'Edinburgh, Scotland',
  'Dublin, Ireland',
  'Florence, Italy',
  'Venice, Italy',
  'Athens, Greece',
  'Santorini, Greece',
  'Istanbul, Turkey',
  'Dubrovnik, Croatia',
  'Seville, Spain',
  'Porto, Portugal',
  'Marrakech, Morocco',
  'Cape Town, South Africa',
  'Dubai, UAE',
  'Singapore',
  'Hong Kong',
  'Seoul, South Korea',
  'Kyoto, Japan',
  'Osaka, Japan',
  'Hanoi, Vietnam',
  'Bali, Indonesia',
  'Melbourne, Australia',
  'Auckland, New Zealand',
  'Queenstown, New Zealand',
  'Los Angeles, CA',
  'San Francisco, CA',
  'Chicago, IL',
  'New Orleans, LA',
  'Austin, TX',
  'Miami, FL',
  'Seattle, WA',
  'Nashville, TN',
  'Boston, MA',
  'Honolulu, HI',
  'Montreal, QC, Canada',
  'Toronto, ON, Canada',
  'Quebec City, QC, Canada',
  'Banff, AB, Canada',
  'Mexico City, Mexico',
  'Cartagena, Colombia',
  'Buenos Aires, Argentina',
  'Rio de Janeiro, Brazil',
  'Cusco, Peru',
];

// Snapshot of everything a build depends on, taken right after a successful generation.
// Diffing the next submission against this lets us detect a change scoped to just one
// category (e.g. a diet restriction) and regenerate only that category's spots instead
// of rebuilding the whole trip from scratch.
interface BuiltConfig {
  location: string;
  days: number;
  perDayCounts: DayCounts[];
  dietSelection: CategorySelection;
  attractionSelection: CategorySelection;
  foodStyleSelection: CategorySelection;
  otherSelection: CategorySelection;
  budget: Budget;
  travelParty: TravelParty;
  pace: Pace;
  transportation: Transportation;
  sourceWeights: SourceWeights;
  hiddenGemMode: boolean;
  optimizeRoutes: boolean;
}

export default function Home() {
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayCount, setDayCount] = useState<number | ''>(3);
  const [datesExpanded, setDatesExpanded] = useState(false);
  const [eventAnchorDate, setEventAnchorDate] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [perDayCounts, setPerDayCounts] = useState<DayCounts[]>(() => Array.from({ length: 3 }, () => ({ food: 3, attraction: 3 })));
  const [dietSelection, setDietSelection] = useState<CategorySelection>({ items: [], strict: false });
  const [attractionSelection, setAttractionSelection] = useState<CategorySelection>({ items: [], strict: false });
  const [foodStyleSelection, setFoodStyleSelection] = useState<CategorySelection>({ items: [], strict: false });
  const [otherSelection, setOtherSelection] = useState<CategorySelection>({ items: [], strict: false });
  const [budget, setBudget] = useState<Budget>('No preference');
  const [travelParty, setTravelParty] = useState<TravelParty>('No preference');
  const [pace, setPace] = useState<Pace>('No preference');
  const [transportation, setTransportation] = useState<Transportation>('No preference');
  const [hiddenGemMode, setHiddenGemMode] = useState(false);
  const [optimizeRoutes, setOptimizeRoutes] = useState(false);
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>({
    google: 100,
    reddit: 0,
    ticketmaster: 0,
  });
  const [sourceConfig, setSourceConfig] = useState<SourceConfig | null>(null);
  const [lastBuiltConfig, setLastBuiltConfig] = useState<BuiltConfig | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<ItineraryItem | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [viewMode, setViewMode] = useState<'map' | 'calendar' | 'table'>('map');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'setup' | 'list'>('setup');
  const [pickedLatLng, setPickedLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [calendarSubView, setCalendarSubView] = useState<CalendarSubView>('week');
  const [mapDayFilter, setMapDayFilter] = useState<'all' | number>('all');
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [addPlaceSeed, setAddPlaceSeed] = useState<{ address?: string; lat?: number; lng?: number; name?: string; day?: number } | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareEncoded, setShareEncoded] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobilePane, setMobilePane] = useState<'plan' | 'view'>('plan');
  const [notice, setNotice] = useState<string | null>(null);
  const [movingItem, setMovingItem] = useState<ItineraryItem | null>(null);
  const [listDropTarget, setListDropTarget] = useState<{ item: ItineraryItem; position: DropPosition } | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState('en');
  const [translating, setTranslating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A shared link is authoritative about every option it carries, language included — the
    // share-loading effect below applies it. Only fall back to the viewer's own saved
    // preference on an ordinary (non-shared) visit, so the two can never race each other.
    if (parseShareHash(window.location.hash)) return;
    // A setTimeout, not a bare call — the lint rule here (react-hooks/set-state-in-effect)
    // only allows setState from inside a promise .then, an event handler, or a timeout.
    setTimeout(() => {
      try {
        const saved = window.localStorage.getItem('tp-language');
        if (saved) setLanguage(saved);
      } catch {
        // Private browsing or storage disabled — just starts in English every time.
      }
    }, 0);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('tp-language', language);
    } catch {
      // Not persisted, but the page still translates for this session.
    }
    if (rootRef.current) applyTranslation(rootRef.current, language, '/api/translate', setTranslating);
  }, [language]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then(setSourceConfig)
      .catch(() => setSourceConfig(null));
  }, []);

  // Opening a share link loads its trip straight from the URL hash into a private local copy.
  useEffect(() => {
    const shared = parseShareHash(window.location.hash);
    if (!shared) return;

    decodeTrip(shared.trip).then((trip) => {
      if (!trip) return;
      const endDate = trip.startDate ? addDays(trip.startDate, trip.days - 1) : '';

      setLocation(trip.location);
      setStartDate(trip.startDate ?? '');
      setEndDate(endDate);
      setDayCount(trip.days);
      setPerDayCounts(
        Array.from({ length: trip.days }, (_, i) => ({
          food: trip.itinerary.filter((x) => x.day === i + 1 && x.category === 'Food').length,
          attraction: trip.itinerary.filter((x) => x.day === i + 1 && x.category === 'Attraction').length,
        })),
      );
      setItinerary(trip.itinerary);
      setSidebarMode('list');
      setMapKey((k) => k + 1);
      setViewMode(shared.options.view);
      setMapDayFilter(shared.options.day ?? 'all');
      setShowRoutes(shared.options.routes);
      setCalendarSubView(shared.options.calendar);
      setLanguage(shared.options.language);
      setMobilePane('view');
    });
  }, []);

  const hasBothDates = !!(startDate && endDate && endDate >= startDate);
  const days = hasBothDates ? daysBetween(startDate, endDate) : (dayCount === '' ? 0 : dayCount);
  const tripNights = Math.max(0, days - 1);

  const syncPerDayCounts = (newDays: number) => {
    setPerDayCounts((prev) => {
      const next = prev.slice(0, newDays);
      while (next.length < newDays) next.push({ food: 3, attraction: 3 });
      return next;
    });
  };

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 6000);
  };

  const limitMessage = 'Trips are limited to ' + MAX_TRIP_DAYS + ' days.';

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && endDate && endDate >= value) {
      let newDays = daysBetween(value, endDate);
      if (newDays > MAX_TRIP_DAYS) {
        newDays = MAX_TRIP_DAYS;
        setEndDate(addDays(value, MAX_TRIP_DAYS - 1));
        showNotice(limitMessage + ' Your end date was moved to fit.');
      }
      setDayCount(newDays);
      syncPerDayCounts(newDays);
    } else {
      syncPerDayCounts(dayCount === '' ? 0 : dayCount);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (startDate && value && value >= startDate) {
      let newDays = daysBetween(startDate, value);
      if (newDays > MAX_TRIP_DAYS) {
        newDays = MAX_TRIP_DAYS;
        setEndDate(addDays(startDate, MAX_TRIP_DAYS - 1));
        showNotice(limitMessage + ' Your end date was moved to fit.');
      }
      setDayCount(newDays);
      syncPerDayCounts(newDays);
    } else {
      syncPerDayCounts(dayCount === '' ? 0 : dayCount);
    }
  };

  // Bidirectional: editing the day count while both dates are set shifts the end date to
  // match, instead of being locked — either the dates or the count can drive the other.
  const handleDayCountChange = (raw: string) => {
    if (raw === '') {
      setDayCount('');
      if (!hasBothDates) syncPerDayCounts(0);
      return;
    }
    let next = Number(raw);
    if (next > MAX_TRIP_DAYS) {
      next = MAX_TRIP_DAYS;
      showNotice(limitMessage);
    }
    setDayCount(next);
    if (hasBothDates && startDate) {
      setEndDate(addDays(startDate, next - 1));
    }
    syncPerDayCounts(next);
  };

  const handleEventDatePick = (dateStr: string) => {
    const end = addDays(dateStr, MAX_TRIP_DAYS - 1);
    setEventAnchorDate(dateStr);
    setStartDate(dateStr);
    setEndDate(end);
    setDayCount(daysBetween(dateStr, end));
    syncPerDayCounts(daysBetween(dateStr, end));
  };

  const handleRandomize = () => {
    const others = DEMO_DESTINATIONS.filter((d) => d !== location);
    setLocation(others[Math.floor(Math.random() * others.length)]);
  };

  const totalSpots = perDayCounts.reduce((sum, d) => sum + d.food + d.attraction, 0);
  const totalSourceWeight = Object.values(sourceWeights).reduce((sum, v) => sum + v, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSourceWeight <= 0) {
      setError('At least one source in Source Emphasis must be above 0%.');
      return;
    }
    if (startDate && !endDate) {
      setError('Please also choose an end date, or clear the start date.');
      return;
    }
    if (!startDate && endDate) {
      setError('Please also choose a start date, or clear the end date.');
      return;
    }
    if (startDate && endDate) {
      if (endDate < startDate) {
        setError('End date must be on or after start date.');
        return;
      }
    } else if (dayCount === '' || dayCount < 1) {
      setError('Please enter the number of days.');
      return;
    }
    if (days > MAX_TRIP_DAYS) {
      setError(limitMessage);
      return;
    }
    if (totalSpots < 1 || totalSpots > MAX_SPOTS) {
      setError(`Total spots across all days must be between 1 and ${MAX_SPOTS}.`);
      return;
    }
    setLoading(true);
    setError(null);
    setWarnings([]);
    setSelectedSpot(null);
    setPickedLatLng(null);
    setViewMode('map');
    setMapDayFilter('all');
    let buildStamp: number | null = null;
    try {
      const categoryTags = (selection: CategorySelection): PreferenceTag[] =>
        selection.items.map((text) => ({ text, required: selection.strict }));

      const currentConfig: BuiltConfig = {
        location, days, perDayCounts, dietSelection, attractionSelection, foodStyleSelection, otherSelection,
        budget, travelParty, pace, transportation, sourceWeights, hiddenGemMode, optimizeRoutes,
      };

      // If a trip is already built and only one category's inputs changed (e.g. a diet
      // restriction was added), regenerate just that category instead of the whole trip:
      // the other category's already-chosen spots are preserved as-is.
      let regenerateOnly: 'Food' | 'Attraction' | null = null;
      if (itinerary.length > 0 && lastBuiltConfig) {
        const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        const sharedChanged = location !== lastBuiltConfig.location
          || days !== lastBuiltConfig.days
          || budget !== lastBuiltConfig.budget
          || travelParty !== lastBuiltConfig.travelParty
          || pace !== lastBuiltConfig.pace
          || transportation !== lastBuiltConfig.transportation
          || hiddenGemMode !== lastBuiltConfig.hiddenGemMode
          || optimizeRoutes !== lastBuiltConfig.optimizeRoutes
          || !eq(sourceWeights, lastBuiltConfig.sourceWeights)
          || !eq(otherSelection, lastBuiltConfig.otherSelection);

        const foodCountsChanged = !eq(perDayCounts.map((d) => d.food), lastBuiltConfig.perDayCounts.map((d) => d.food));
        const attractionCountsChanged = !eq(perDayCounts.map((d) => d.attraction), lastBuiltConfig.perDayCounts.map((d) => d.attraction));
        const foodTouched = foodCountsChanged || !eq(dietSelection, lastBuiltConfig.dietSelection) || !eq(foodStyleSelection, lastBuiltConfig.foodStyleSelection);
        const attractionTouched = attractionCountsChanged || !eq(attractionSelection, lastBuiltConfig.attractionSelection);

        if (!sharedChanged && foodTouched && !attractionTouched) {
          regenerateOnly = 'Food';
        } else if (!sharedChanged && attractionTouched && !foodTouched) {
          regenerateOnly = 'Attraction';
        }
      }

      const submittedPerDayCounts = regenerateOnly === 'Food'
        ? perDayCounts.map((d) => ({ food: d.food, attraction: 0 }))
        : regenerateOnly === 'Attraction'
          ? perDayCounts.map((d) => ({ food: 0, attraction: d.attraction }))
          : perDayCounts;

      const body: ItineraryRequest = {
        location,
        days,
        startDate: hasBothDates ? startDate : undefined,
        perDayCounts: submittedPerDayCounts,
        preferences: [
          ...categoryTags(dietSelection),
          ...categoryTags(attractionSelection),
          ...categoryTags(foodStyleSelection),
          ...categoryTags(otherSelection),
        ],
        budget,
        travelParty,
        pace,
        transportation,
        sourceWeights,
        hiddenGemMode,
        optimizeRoutes,
        regenerateScope: regenerateOnly ?? undefined,
      };
      // Full builds are limited per browser; a one-category regeneration isn't counted.
      if (!regenerateOnly) {
        const limit = checkBuildLimit();
        if (!limit.allowed) {
          setError(buildLimitMessage(limit.retryAfterSeconds));
          return;
        }
        buildStamp = recordBuild();
      }

      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate itinerary');
        // A build that failed on our side shouldn't use up an attempt (a 429 already counted).
        if (buildStamp !== null && res.status !== 429) refundBuild(buildStamp);
      } else {
        if (regenerateOnly) {
          const keepCategory = regenerateOnly === 'Food' ? 'Attraction' : 'Food';
          const preserved = itinerary.filter((i) => i.category === keepCategory);
          setItinerary([...preserved, ...(data.itinerary || [])]);
        } else {
          setItinerary(data.itinerary || []);
        }
        setWarnings(data.warnings || []);
        setLastBuiltConfig(currentConfig);
        setMapKey((k) => k + 1);
        setSidebarMode('list');
        setMobilePane('view');
        setCalendarSubView(days <= 1 ? 'day' : 'week');
      }
    } catch {
      if (buildStamp !== null) refundBuild(buildStamp);
      setError('Failed to reach the server');
    } finally {
      setLoading(false);
    }
  };

  const center = itinerary.length > 0
    ? { lat: itinerary[0].lat, lng: itinerary[0].lng }
    : DEFAULT_CENTER;
  const zoom = itinerary.length > 0 ? 12 : DEFAULT_ZOOM;

  const sortedItinerary = [...itinerary].sort((a, b) => a.day - b.day || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  const dayRoutes = Array.from(new Set(itinerary.map((i) => i.day)))
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      color: dayColor(day),
      path: sortedItinerary.filter((i) => i.day === day).map((i) => ({ lat: i.lat, lng: i.lng })),
    }));

  const uniqueDays = Array.from(new Set(itinerary.map((i) => i.day))).sort((a, b) => a - b);
  const singleDay = days <= 1 && uniqueDays.length <= 1;
  const hoursStartDate = hasBothDates ? startDate : undefined;
  // The calendar shows real dates even for an undated trip (counting from today), so a place
  // added by clicking one of its cells should be labeled with that same date.
  const modalStartDate = hasBothDates ? startDate : viewMode === 'calendar' ? todayStr() : undefined;
  const mapItems = mapDayFilter === 'all' ? sortedItinerary : sortedItinerary.filter((i) => i.day === mapDayFilter);
  const mapDayRoutes = mapDayFilter === 'all' ? dayRoutes : dayRoutes.filter((r) => r.day === mapDayFilter);
  const travelMode: TravelMode = transportation === 'Walking / Transit' ? 'WALK' : 'DRIVE';
  const routeData = useDayRoutes(dayRoutes, travelMode);
  const mapsLinks = dayRoutes.flatMap((r) => {
    const url = googleMapsDayUrl(r.path, travelMode);
    return url ? [{ day: r.day, color: r.color, url }] : [];
  });

  const calendarAnchorDate = hasBothDates ? startDate : todayStr();

  const handleMapGeocoded = useCallback(async (result: ReverseGeocodeResult) => {
    if (itinerary.length === 0) {
      setLocation(result.locality ?? result.formattedAddress);
      return;
    }
    if (!pickedLatLng) return;

    const { lat, lng } = pickedLatLng;
    let address = result.formattedAddress;
    let name: string | undefined;

    try {
      const nearbyRes = await fetch(`/api/nearby-place?lat=${lat}&lng=${lng}`);
      if (nearbyRes.ok) {
        const nearby = await nearbyRes.json();
        if (nearby?.name) {
          name = nearby.name;
          address = nearby.address || address;
        }
      }
    } catch {
      // fall back to the plain reverse-geocoded address below
    }

    setAddPlaceSeed({ address, lat, lng, name });
    setEditingItem(null);
    setShowAddPlace(true);
  }, [itinerary.length, pickedLatLng]);

  // A short trip's calendar offers days past its end; using one extends the trip to it.
  const extendTripTo = (day: number) => {
    if (day <= days) return;
    setDayCount(day);
    if (hasBothDates) setEndDate(addDays(startDate, day - 1));
    syncPerDayCounts(day);
  };

  const openAddPlace = (day?: number) => {
    setAddPlaceSeed(day ? { day } : null);
    setEditingItem(null);
    setShowAddPlace(true);
  };

  const handleSavePlace = (item: ItineraryItem) => {
    if (editingItem) {
      setItinerary((prev) => prev.map((i) => (i === editingItem ? item : i)));
      setEditingItem(null);
    } else {
      setItinerary((prev) => [...prev, item]);
    }
    setPickedLatLng(null);
    extendTripTo(item.day);
  };

  const handleEditRequest = (item: ItineraryItem) => {
    setEditingItem(item);
    setAddPlaceSeed(null);
    setShowAddPlace(true);
  };

  const handleImport = (items: ItineraryItem[]) => {
    const kept = items.filter((i) => i.day <= MAX_TRIP_DAYS);
    const skipped = items.length - kept.length;
    setItinerary((prev) => [...prev, ...kept]);
    extendTripTo(Math.max(0, ...kept.map((i) => i.day)));
    setSidebarMode('list');
    if (skipped > 0) {
      showNotice(limitMessage + ' ' + skipped + ' imported place' + (skipped === 1 ? '' : 's') + ' beyond day ' + MAX_TRIP_DAYS + ' were skipped.');
    }
  };

  const handleMoveItem = (from: number, target: MoveTarget) => {
    const result = moveItem(itinerary, from, target);
    if (!result) return;
    if (selectedSpot === itinerary[from]) setSelectedSpot(result.moved);
    setItinerary(result.items);

    if (target.kind !== 'item') extendTripTo(target.day);
  };

  const handleMoveTo = (item: ItineraryItem, day: number, slot: ItineraryItem['slot']) => {
    handleMoveItem(itinerary.indexOf(item), { kind: 'slot', day, slot });
  };

  const currentShareOptions: ShareOptions = {
    view: viewMode,
    day: mapDayFilter === 'all' ? null : mapDayFilter,
    routes: showRoutes,
    calendar: calendarSubView,
    language,
  };

  const shareUrl = shareEncoded
    ? window.location.origin + '/' + buildShareHash(shareEncoded, currentShareOptions)
    : null;

  const openShare = async () => {
    const encoded = await encodeTrip({
      location,
      days,
      startDate: hasBothDates ? startDate : undefined,
      itinerary,
    });
    setShareEncoded(encoded);
    setShareCopied(false);
    // Opening the dialog copies the link as a convenience, but "Copied!" only shows once the
    // user actually clicks the button below — otherwise it'd read "Copied!" before they'd done
    // anything themselves.
    navigator.clipboard
      .writeText(window.location.origin + '/' + buildShareHash(encoded, currentShareOptions))
      .catch(() => {});

    // Captures any custom places (a dropped pin, a typed address, an imported row) into the
    // shared city pool — the itinerary route already contributes generated places on its own,
    // but never sees hand-added ones. Fire-and-forget: never blocks or affects sharing itself.
    fetch('/api/contribute-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, itinerary }),
    }).catch(() => {});
  };

  const shareMapsLinks = mapDayFilter === 'all' ? mapsLinks : mapsLinks.filter((l) => l.day === mapDayFilter);

  const handleChatOps = (ops: ChatOp[]) => {
    // (a plain object, since Map is the Google Maps component in this file)
    const swaps: Record<number, ItineraryItem> = {};
    const removals = new Set<number>();
    const additions: ItineraryItem[] = [];
    for (const op of ops) {
      if (op.type === 'swap') swaps[op.index] = op.item;
      else if (op.type === 'remove') removals.add(op.index);
      else additions.push(op.item);
    }

    const selectedIndex = selectedSpot ? itinerary.indexOf(selectedSpot) : -1;
    if (removals.has(selectedIndex) || selectedIndex in swaps) setSelectedSpot(null);

    const kept = itinerary.map((item, i) => swaps[i] ?? item).filter((_, i) => !removals.has(i));
    setItinerary([...kept, ...additions]);
  };

  // Keep the address bar's link in step with the trip and what's on screen, so copying the
  // current URL is always enough to share exactly this.
  const hadTripRef = useRef(false);
  useEffect(() => {
    if (itinerary.length === 0) {
      if (hadTripRef.current) {
        hadTripRef.current = false;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }
    hadTripRef.current = true;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const encoded = await encodeTrip({
        location,
        days,
        startDate: hasBothDates ? startDate : undefined,
        itinerary,
      });
      if (cancelled) return;
      const hash = buildShareHash(encoded, {
        view: viewMode,
        day: mapDayFilter === 'all' ? null : mapDayFilter,
        routes: showRoutes,
        calendar: calendarSubView,
        language,
      });
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [itinerary, location, days, hasBothDates, startDate, viewMode, mapDayFilter, showRoutes, calendarSubView, language]);

  // The Routes button only means something once a day has at least two stops to connect.
  const canShowRoutes = mapDayRoutes.some((r) => r.path.length >= 2);
  const showDayStepper = itinerary.length > 0 && !singleDay;
  const showSubRow =
    (viewMode === 'map' && (canShowRoutes || showDayStepper)) || (viewMode === 'calendar' && itinerary.length > 0);

  const addPlaceMenu = <AddPlaceMenu onAdd={() => openAddPlace()} onImport={() => setShowImport(true)} />;

  return (
    <div ref={rootRef} className="relative flex h-dvh w-screen overflow-hidden bg-background font-sans">
      {/* Sidebar Controls & List */}
      <div
        className={`h-full bg-white border-r border-gray-200 flex-col shadow-lg z-10 transition-all w-full p-6 max-md:p-4 max-md:pb-20 overflow-y-auto ${mobilePane === 'plan' ? 'flex' : 'hidden md:flex'} ${
          sidebarCollapsed ? 'md:w-0 md:p-0 md:overflow-hidden' : 'md:w-1/3'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            Itinerary Planner
          </h1>
          <div className="flex items-center gap-1.5">
            {itinerary.length > 0 && (
              <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                <button
                  onClick={() => setSidebarMode('setup')}
                  title="Setup"
                  className={`p-1.5 rounded ${sidebarMode === 'setup' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => setSidebarMode('list')}
                  title="Trip List"
                  className={`p-1.5 rounded ${sidebarMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
                >
                  <ListIcon size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              className="hidden md:flex p-1.5 rounded text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>

        {sidebarMode === 'setup' && (
        <>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Destination</label>
              <button
                type="button"
                onClick={handleRandomize}
                title="Pick a random destination"
                className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary-hover"
              >
                <Dice5 size={12} /> Randomize
              </button>
            </div>
            <DestinationAutocomplete value={location} onChange={setLocation} />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDatesExpanded((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Dates</span>
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {days || 3} day{(days || 3) === 1 ? '' : 's'}{hasBothDates ? `, ${tripNights} night${tripNights === 1 ? '' : 's'}` : ''}
                </span>
                {datesExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </span>
            </button>

            {datesExpanded && (
              <div className="mt-2 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                    Number of Days <span className="normal-case font-normal text-gray-400">(max {MAX_TRIP_DAYS})</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_TRIP_DAYS}
                    value={dayCount}
                    onChange={(e) => handleDayCountChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleStartDateChange('')}
                      className="mt-1 text-[10px] font-medium text-gray-400 hover:text-primary"
                    >
                      Clear
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      max={startDate ? addDays(startDate, MAX_TRIP_DAYS - 1) : undefined}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleEndDateChange('')}
                      className="mt-1 text-[10px] font-medium text-gray-400 hover:text-primary"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary-hover py-1"
          >
            {showAdvanced ? <>Hide options <ChevronUp size={14} /></> : <>More options <ChevronDown size={14} /></>}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-4 pt-2 border-t border-gray-200">
              <PerDayCountsEditor value={perDayCounts} onChange={setPerDayCounts} />

              <CategoryPreferenceGroup label="Diet" options={DIET_OPTIONS} value={dietSelection} onChange={setDietSelection} />
              <CategoryPreferenceGroup label="Attractions" options={ATTRACTION_OPTIONS} value={attractionSelection} onChange={setAttractionSelection} />
              <CategoryPreferenceGroup label="Food Style" options={FOOD_STYLE_OPTIONS} value={foodStyleSelection} onChange={setFoodStyleSelection} />

              <SingleChoiceGroup label="Budget" options={BUDGET_OPTIONS} value={budget} onChange={(v) => setBudget(v as Budget)} />
              <SingleChoiceGroup label="Travel Party" options={PARTY_OPTIONS} value={travelParty} onChange={(v) => setTravelParty(v as TravelParty)} />
              <SingleChoiceGroup label="Pace" options={PACE_OPTIONS} value={pace} onChange={(v) => setPace(v as Pace)} />
              <SingleChoiceGroup label="Transportation" options={TRANSPORT_OPTIONS} value={transportation} onChange={(v) => setTransportation(v as Transportation)} />

              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={optimizeRoutes}
                  onChange={(e) => setOptimizeRoutes(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Optimize each day&apos;s route to reduce backtracking (may override date-specific timing, like weekend/weekday placement)</span>
              </label>

              <PreferenceTagInput value={otherSelection} onChange={setOtherSelection} />

              <SourceWeightSliders
                value={sourceWeights}
                onChange={setSourceWeights}
                config={sourceConfig}
                aiEnabled={hiddenGemMode}
                onAiChange={setHiddenGemMode}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || totalSourceWeight <= 0}
            title={totalSourceWeight <= 0 ? 'At least one source in Source Emphasis must be above 0%' : undefined}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-primary-hover flex justify-center items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Build Trip Plan'}
          </button>
        </form>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 flex flex-col gap-1">
            {warnings.map((w, i) => <span key={i}>{w}</span>)}
          </div>
        )}

        </>
        )}

        {sidebarMode === 'list' && itinerary.length > 0 && (
          <div className="pr-1">
            {sortedItinerary.map((item, idx) => {
              const prev = sortedItinerary[idx - 1];
              const next = sortedItinerary[idx + 1];
              const firstOfDay = !prev || prev.day !== item.day;
              const dayStops = sortedItinerary.filter((i) => i.day === item.day);
              const route = routeData[item.day];
              const dayTravel = route ? route.legs.reduce((sum, l) => sum + l.durationSeconds, 0) : 0;
              const leg = next && next.day === item.day ? route?.legs[dayStops.indexOf(item)] : undefined;
              const hours = hoursNoteForItem(item, hoursStartDate);
              const modeIcon = travelMode === 'WALK' ? '🚶' : '🚗';

              return (
              <Fragment key={idx}>
              {firstOfDay && (
                <div className="flex items-center justify-between gap-2 mb-2 mt-1 text-[11px] font-semibold text-gray-500">
                  <span>
                    {!singleDay && 'Day ' + item.day + ' · '}
                    {dayStops.length} stop{dayStops.length === 1 ? '' : 's'}
                    {dayTravel > 0 && (
                      <span className={dayTravel > 3 * 3600 ? 'text-amber-600' : ''}>
                        {' · ' + modeIcon + ' ' + formatDuration(dayTravel) + (dayTravel > 3 * 3600 ? ' ⚠️' : '')}
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div
                draggable
                onDragStart={(e) => startItemDrag(e, itinerary.indexOf(item))}
                onDragOver={(e) => {
                  if (!isItineraryDrag(e)) return;
                  e.preventDefault();
                  const position = dropPosition(e);
                  setListDropTarget((prev) => (prev?.item === item && prev.position === position ? prev : { item, position }));
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setListDropTarget(null);
                }}
                onDrop={(e) => {
                  const from = readDraggedIndex(e);
                  const position = dropPosition(e);
                  setListDropTarget(null);
                  if (from === null) return;
                  e.preventDefault();
                  handleMoveItem(from, { kind: 'item', anchor: item, position });
                }}
                onDragEnd={() => setListDropTarget(null)}
                onClick={() => setSelectedSpot(item)}
                style={
                  listDropTarget?.item === item
                    ? { boxShadow: listDropTarget.position === 'before' ? '0 -3px 0 0 #1b2a41' : '0 3px 0 0 #1b2a41' }
                    : undefined
                }
                className={`p-4 mb-3 border rounded-xl cursor-pointer transition-all ${
                  selectedSpot?.name === item.name
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-primary mb-1.5">
                  {!singleDay && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: dayColor(item.day) }}
                    >
                      Day {item.day}
                    </span>
                  )}
                  <span className="text-base leading-none" title={item.category}>
                    {getSpotEmoji(item)}
                  </span>
                  <span className="text-gray-400 font-medium">{item.slot}</span>
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-1 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    {item.name}
                    {item.redditMentioned && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: '#FF4500' }}
                        title="Mentioned on Reddit"
                      >
                        Reddit
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMovingItem((m) => (m === item ? null : item));
                      }}
                      className="text-[10px] font-semibold text-gray-400 hover:text-primary underline decoration-dotted pointer-coarse:text-xs pointer-coarse:py-1.5 pointer-coarse:px-1"
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditRequest(item);
                      }}
                      className="text-[10px] font-semibold text-gray-400 hover:text-primary underline decoration-dotted pointer-coarse:text-xs pointer-coarse:py-1.5 pointer-coarse:px-1"
                    >
                      Edit
                    </button>
                  </span>
                </h3>
                {movingItem === item && (
                  <MovePanel
                    item={item}
                    dayCount={Math.max(days, 1)}
                    onMove={(day, slot) => {
                      setMovingItem(null);
                      handleMoveTo(item, day, slot);
                    }}
                  />
                )}
                <p className="text-xs text-gray-500 flex items-start gap-1 mb-2">
                  <MapPin size={12} className="shrink-0 mt-0.5 text-gray-400" /> {item.address}
                </p>
                {hours && (
                  <p className="text-[11px] text-gray-500 mb-1">
                    🕒 {hours.dayText}
                    {hours.warning && <span className="ml-1.5 text-amber-600 font-medium">⚠️ {hours.warning}</span>}
                  </p>
                )}
                <p className="text-xs text-gray-600 leading-relaxed">{item.notes}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">Sources: {sourcesForItem(item)}</p>

                {selectedSpot?.name === item.name && item.reviewHighlights && item.reviewHighlights.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1.5">
                    {item.reviewHighlights.map((quote, i) => (
                      <p key={i} className="text-xs italic text-gray-500 bg-gray-50 rounded-md p-2">
                        &ldquo;{quote}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {leg && (
                <div className="-mt-2 mb-1 flex items-center gap-1.5 pl-3 text-[10px] text-gray-400">
                  <span>{modeIcon}</span>
                  {formatDuration(leg.durationSeconds)} · {formatDistance(leg.distanceMeters)}
                </div>
              )}
              </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Re-expand button, shown only while collapsed — the collapse button itself lives in the sidebar header */}
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          className="hidden md:flex items-center justify-center absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Map / Calendar / Table Panel */}
      <div className={(mobilePane === 'view' ? 'flex' : 'hidden md:flex') + ' flex-col flex-1 h-full relative max-md:pb-14'}>
        <div className={`flex items-end justify-between max-md:justify-end gap-1.5 pt-3 max-md:pt-2 pr-4 bg-gray-200 border-b border-gray-300 transition-all pl-4 ${sidebarCollapsed ? 'md:pl-16' : ''}`}>
            <div className="flex items-end gap-3 max-md:hidden">
              <div className="flex items-end gap-1">
                {([
                  { key: 'map' as const, label: 'Map', Icon: MapIcon },
                  { key: 'calendar' as const, label: 'Calendar', Icon: CalendarDays },
                  { key: 'table' as const, label: 'Table', Icon: TableIcon },
                ]).map(({ key, label, Icon }) => {
                  const active = viewMode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setViewMode(key)}
                      className={
                        'flex items-center gap-2 text-sm px-5 py-2.5 rounded-t-lg border transition-colors ' +
                        (active
                          ? 'bg-white text-primary font-semibold border-gray-300 border-b-white border-t-2 border-t-primary -mb-px relative z-10'
                          : 'bg-gray-100 text-gray-500 border-gray-300 mt-1 hover:bg-gray-50 hover:text-gray-700')
                      }
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 mb-1.5">
              <select
                data-no-translate
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Language"
                className="text-xs px-2 py-1.5 rounded-md font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              {translating && (
                <Loader2 data-no-translate size={14} className="animate-spin text-primary shrink-0 mr-0.5" aria-label="Translating" />
              )}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  disabled={itinerary.length === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Share2 size={14} /> Share <ChevronDown size={12} />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        openShare();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <Share2 size={12} className="text-primary" /> Copy share link
                    </button>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={() => {
                        exportMapsCsv(itinerary, location);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <Download size={12} className="text-primary" /> Google Maps Table (CSV)
                    </button>
                    <button
                      onClick={() => {
                        exportIcal(itinerary, calendarAnchorDate, location);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <Download size={12} className="text-primary" /> Calendar (.ics)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        {showSubRow && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
            {viewMode === 'map' && (
              <>
                {canShowRoutes && (
                  <button
                    type="button"
                    onClick={() => setShowRoutes((v) => !v)}
                    className={
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium ' +
                      (showRoutes ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                    }
                  >
                    <RouteIcon size={14} /> Routes
                  </button>
                )}
                {showDayStepper && (
                  <OptionStepper
                    title="Filter the map by day"
                    options={[
                      { value: 'all', label: 'All Days' },
                      ...uniqueDays.map((d) => ({ value: String(d), label: 'Day ' + d, color: dayColor(d) })),
                    ]}
                    value={String(mapDayFilter)}
                    onChange={(v) => setMapDayFilter(v === 'all' ? 'all' : Number(v))}
                  />
                )}
              </>
            )}
            {viewMode === 'calendar' && (
              <OptionStepper
                title="Calendar view"
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
                value={calendarSubView}
                onChange={(v) => setCalendarSubView(v as CalendarSubView)}
              />
            )}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {viewMode === 'calendar' ? (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <CalendarView
                itinerary={itinerary}
                startDate={calendarAnchorDate}
                days={Math.max(days, 1)}
                selectedSpot={selectedSpot}
                onSelect={setSelectedSpot}
                onPickDate={handleEventDatePick}
                pickedDate={eventAnchorDate}
                onMoveItem={handleMoveItem}
                subView={calendarSubView}
                onAddOnDay={openAddPlace}
                actions={addPlaceMenu}
              />
            </div>
          ) : viewMode === 'table' ? (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <TableView
                itinerary={itinerary}
                selectedSpot={selectedSpot}
                onSelect={setSelectedSpot}
                onMoveItem={handleMoveItem}
                showDay={!singleDay}
                startDate={hoursStartDate}
                actions={addPlaceMenu}
              />
            </div>
          ) : (
            <div className="relative w-full h-full">
            {/* Pinned at a known stacking level so the overlay below can be dropped
                unambiguously beneath it (an explicit z-index of 0 doesn't reliably beat
                z-index: auto — DOM order still wins ties — so both sides need real numbers). */}
            <div className="relative z-10 w-full h-full">
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} language={language}>
              <Map
                key={mapKey + '-' + mobilePane}
                style={{ width: '100%', height: '100%' }}
                defaultCenter={center}
                defaultZoom={zoom}
                mapId="TRIP_PLANNER_MAP_ID"
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapTypeControl={false}
                zoomControl
                restriction={{ latLngBounds: WORLD_BOUNDS, strictBounds: true }}
                onClick={(e) => {
                  if (e.detail.latLng) setPickedLatLng(e.detail.latLng);
                }}
              >
                <ReverseGeocoder latLng={pickedLatLng} onResolved={handleMapGeocoded} />

                {pickedLatLng && (
                  <AdvancedMarker position={pickedLatLng}>
                    <Pin background="#dc2626" glyphColor="#ffffff" borderColor="#ffffff" />
                  </AdvancedMarker>
                )}

                {showRoutes && mapDayRoutes.map((r) => (
                  <RoutePolyline key={r.day} path={routeData[r.day]?.path ?? r.path} color={r.color} />
                ))}

                {mapItems.map((item, idx) => {
                  const selected = selectedSpot?.name === item.name;
                  return (
                    <AdvancedMarker
                      key={idx}
                      position={{ lat: item.lat, lng: item.lng }}
                      onClick={() => setSelectedSpot(item)}
                    >
                      <div
                        className="flex items-center justify-center rounded-full shadow-md"
                        style={{
                          backgroundColor: dayColor(item.day),
                          width: selected ? 40 : 32,
                          height: selected ? 40 : 32,
                          fontSize: selected ? 20 : 16,
                          border: selected ? '2px solid #111827' : '2px solid #ffffff',
                        }}
                        title={item.name}
                      >
                        {getSpotEmoji(item)}
                      </div>
                    </AdvancedMarker>
                  );
                })}

                {selectedSpot && (
                  <InfoWindow
                    position={{ lat: selectedSpot.lat, lng: selectedSpot.lng }}
                    onCloseClick={() => setSelectedSpot(null)}
                    pixelOffset={[0, -40]}
                  >
                    <SpotDetail item={selectedSpot} onEdit={handleEditRequest} onMove={handleMoveTo} dayCount={Math.max(days, 1)} showDay={!singleDay} startDate={hoursStartDate} />
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
            </div>

            {/* The InfoWindow is Google's own pane, nested inside the Map's DOM subtree —
                raising its z-index directly isn't possible, so a selected spot's popup is
                kept on top by dropping this overlay below the map's own stacking level
                instead, rather than raising the map above it permanently (which would bury
                these buttons under the map tiles even with nothing selected). */}
            <div className={`absolute top-4 right-4 md:right-24 flex flex-col items-end gap-2 ${selectedSpot ? 'z-0' : 'z-20'}`}>
              {addPlaceMenu}
              <OpenInGoogleMaps links={mapsLinks} selectedDay={mapDayFilter} singleDay={singleDay} />
            </div>
            </div>
          )}
        </div>

      </div>

        {(viewMode === 'calendar' || viewMode === 'table') && (
          <SpotModal item={selectedSpot} onClose={() => setSelectedSpot(null)} onEdit={handleEditRequest} onMove={handleMoveTo} dayCount={Math.max(days, 1)} showDay={!singleDay} startDate={hoursStartDate} />
        )}

        {showAddPlace && (
          <AddPlaceModal
            days={Math.max(days, 1)}
            startDate={modalStartDate}
            initial={addPlaceSeed ?? undefined}
            editItem={editingItem}
            onAdd={handleSavePlace}
            onClose={() => {
              setShowAddPlace(false);
              setAddPlaceSeed(null);
              setEditingItem(null);
              setPickedLatLng(null);
            }}
          />
        )}

        {showImport && (
          <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />
        )}

        {shareEncoded && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShareEncoded(null)}>
            <div
              className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 flex flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Share Link</h3>
                <button type="button" onClick={() => setShareEncoded(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                The whole trip is stored in this link. Anyone who opens it gets their own copy to edit.
              </p>
              <p className="text-[10px] text-gray-400">Your browser&apos;s address bar always shows this link, so you can also just copy it from there.</p>
              {shareMapsLinks.length > 0 && (
                <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                  <span className="font-semibold">Open in Google Maps</span>
                  <div className="flex flex-wrap gap-1.5">
                    {shareMapsLinks.map((l) => (
                      <a
                        key={l.day}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <Navigation size={12} />
                        {singleDay ? 'Open route' : 'Day ' + l.day}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl ?? ''}
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg text-xs text-gray-700 bg-gray-50"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(shareUrl ?? '')
                      .then(() => {
                        setShareCopied(true);
                        if (shareCopiedTimeoutRef.current) clearTimeout(shareCopiedTimeoutRef.current);
                        shareCopiedTimeoutRef.current = setTimeout(() => setShareCopied(false), 2000);
                      })
                      .catch(() => {})
                  }
                  className="px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover"
                >
                  {shareCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">{(shareUrl ?? '').length.toLocaleString()} characters</p>
            </div>
          </div>
        )}

        <ChatSidebar
          location={location}
          days={Math.max(days, 1)}
          itinerary={itinerary}
          onApply={handleChatOps}
        />

      {notice && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 shadow-lg flex items-start gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-amber-500 hover:text-amber-700 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        {([
          { key: 'plan' as const, label: 'Plan', Icon: ListIcon },
          { key: 'map' as const, label: 'Map', Icon: MapIcon },
          { key: 'calendar' as const, label: 'Calendar', Icon: CalendarDays },
          { key: 'table' as const, label: 'Table', Icon: TableIcon },
        ]).map(({ key, label, Icon }) => {
          const active = key === 'plan' ? mobilePane === 'plan' : mobilePane === 'view' && viewMode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === 'plan') {
                  setMobilePane('plan');
                } else {
                  setViewMode(key);
                  setMobilePane('view');
                }
              }}
              className={
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ' +
                (active ? 'text-primary' : 'text-gray-400')
              }
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
