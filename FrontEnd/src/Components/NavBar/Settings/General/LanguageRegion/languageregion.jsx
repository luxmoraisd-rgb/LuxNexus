import { useMemo, useState } from "react";
import { Globe2, Clock, Calendar, Check, Languages, Sparkles } from "lucide-react";
import "./languageregion.css";

/*
|--------------------------------------------------------------------------
| Compound Component Root
|--------------------------------------------------------------------------
*/

const LanguageRegion = ({ children }) => {
  return (
    <section className="language-region">
      {children}
    </section>
  );
};

/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

LanguageRegion.Header = ({ title }) => {
  return (
    <header className="language-region__header">
      <div className="language-region__header-icon-wrap">
        <Languages size={22} className="language-region__header-icon" />
      </div>
      <div className="language-region__header-text">
        <h1>{title}</h1>
        <p className="language-region__header-sub">
          Customize your display language, timezone, and calendar formats
        </p>
      </div>
    </header>
  );
};

/*
|--------------------------------------------------------------------------
| Setting Section
|--------------------------------------------------------------------------
*/

LanguageRegion.Section = ({ title, children, className = "" }) => {
  return (
    <section className={`language-region__section ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
};

/*
|--------------------------------------------------------------------------
| Select
|--------------------------------------------------------------------------
*/

LanguageRegion.Select = ({
  value,
  onChange,
  options,
  ariaLabel,
}) => {
  return (
    <div className="language-region__select-wrapper">
      <select
        className="language-region__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <span className="language-region__select-arrow">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Radio Group
|--------------------------------------------------------------------------
*/

LanguageRegion.RadioGroup = ({
  name,
  options,
  value,
  onChange,
}) => {
  return (
    <div className="language-region__radio-group">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <label
            className={`language-region__radio-option ${isSelected ? "is-selected" : ""}`}
            key={option.value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={(event) =>
                onChange(event.target.value)
              }
            />

            <span className="custom-radio">
              {isSelected && <span className="custom-radio-dot" />}
            </span>

            <span className="radio-label">
              {option.label}
            </span>

            {option.preview && (
              <span className="radio-preview">
                {option.preview}
              </span>
            )}

            {isSelected && <span className="radio-selected-pip" />}
          </label>
        );
      })}
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Language options
|--------------------------------------------------------------------------
*/

const languageOptions = [
  {
    value: "en",
    label: "English",
  },
  {
    value: "es",
    label: "Spanish",
  },
  {
    value: "fr",
    label: "French",
  },
  {
    value: "de",
    label: "German",
  },
  {
    value: "hi",
    label: "Hindi",
  },
];

/*
|--------------------------------------------------------------------------
| Timezone options
|--------------------------------------------------------------------------
*/

const timezoneOptions = [
  {
    value: "Asia/Kolkata",
    label: "(GMT+05:30) India",
  },
  {
    value: "Asia/Dubai",
    label: "(GMT+04:00) Dubai",
  },
  {
    value: "Asia/Almaty",
    label: "(GMT+05:00) Almaty",
  },
  {
    value: "Europe/London",
    label: "(GMT+00:00) London",
  },
  {
    value: "Europe/Paris",
    label: "(GMT+01:00) Paris",
  },
  {
    value: "America/New_York",
    label: "(GMT-05:00) New York",
  },
  {
    value: "America/Los_Angeles",
    label: "(GMT-08:00) Los Angeles",
  },
  {
    value: "Asia/Tokyo",
    label: "(GMT+09:00) Tokyo",
  },
];

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

const LanguageRegionPage = () => {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("nexus_language") || "en";
    } catch {
      return "en";
    }
  });

  const [timezone, setTimezone] = useState(() => {
    try {
      const stored = localStorage.getItem("nexus_timezone") || sessionStorage.getItem("nexus_timezone");
      if (stored) return stored;
    } catch {
      // ignore
    }
    return "Asia/Kolkata";
  });

  const [timeFormat, setTimeFormat] = useState(() => {
    try {
      return localStorage.getItem("nexus_time_format") || "12";
    } catch {
      return "12";
    }
  });

  const [dateFormat, setDateFormat] = useState(() => {
    try {
      return localStorage.getItem("nexus_date_format") || "day-first";
    } catch {
      return "day-first";
    }
  });

  const [firstDay, setFirstDay] = useState(() => {
    try {
      return localStorage.getItem("nexus_first_day") || "monday";
    } catch {
      return "monday";
    }
  });

  const [saveIndicator, setSaveIndicator] = useState(false);

  const triggerSaveFeedback = () => {
    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 2200);
  };

  const handleTimezoneChange = (val) => {
    setTimezone(val);
    triggerSaveFeedback();
    try {
      localStorage.setItem("nexus_timezone", val);
      sessionStorage.setItem("nexus_timezone", val);
    } catch {
      // ignore
    }
  };

  const handleLanguageChange = (val) => {
    setLanguage(val);
    triggerSaveFeedback();
    try {
      localStorage.setItem("nexus_language", val);
    } catch {
      // ignore
    }
  };

  const handleTimeFormatChange = (val) => {
    setTimeFormat(val);
    triggerSaveFeedback();
    try {
      localStorage.setItem("nexus_time_format", val);
    } catch {
      // ignore
    }
  };

  const handleDateFormatChange = (val) => {
    setDateFormat(val);
    triggerSaveFeedback();
    try {
      localStorage.setItem("nexus_date_format", val);
    } catch {
      // ignore
    }
  };

  const handleFirstDayChange = (val) => {
    setFirstDay(val);
    triggerSaveFeedback();
    try {
      localStorage.setItem("nexus_first_day", val);
    } catch {
      // ignore
    }
  };


  /*
  |--------------------------------------------------------------------------
  | Current date/time
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | Time preview
  |--------------------------------------------------------------------------
  */

  const timePreview = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: timeFormat === "12",
      timeZone: timezone,
    }).format(new Date());
  }, [timezone, timeFormat]);

  /*
  |--------------------------------------------------------------------------
  | Date previews
  |--------------------------------------------------------------------------
  */

  const datePreview = useMemo(() => {
    const date = new Date();

    if (dateFormat === "month-first") {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      }).format(date);
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  }, [dateFormat, timezone]);

  /*
  |--------------------------------------------------------------------------
  | Date options
  |--------------------------------------------------------------------------
  */

  const dateOptions = useMemo(() => {
    const d = new Date();
    const monthFirst = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(d);
    const dayFirst = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(d);
    return [
      {
        value: "day-first",
        label: dayFirst,
      },
      {
        value: "month-first",
        label: monthFirst,
      },
    ];
  }, [timezone]);

  /*
  |--------------------------------------------------------------------------
  | Time options
  |--------------------------------------------------------------------------
  */

  const timeOptions = [
    {
      value: "12",
      label: "12 Hours",
      preview: timePreview,
    },
    {
      value: "24",
      label: "24 Hours",
      preview: timePreview,
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | First day options
  |--------------------------------------------------------------------------
  */

  const firstDayOptions = [
    {
      value: "sunday",
      label: "Sunday",
    },
    {
      value: "monday",
      label: "Monday",
    },
  ];

  const currentTzLabel =
    timezoneOptions.find((t) => t.value === timezone)?.label || timezone;

  return (
    <LanguageRegion>
      <LanguageRegion.Header title="Language & Region" />

      {/* Interactive Live Region & Locale Preview Card */}
      <div className="language-region__live-preview-card">
        <div className="live-preview-header">
          <div className="live-preview-icon-wrap">
            <Globe2 size={18} className="live-preview-globe" />
          </div>
          <div className="live-preview-heading">
            <span className="live-preview-title">Live Locale Preview</span>
            <span className="live-preview-subtitle">{currentTzLabel}</span>
          </div>
          {saveIndicator ? (
            <div className="live-preview-saved-badge is-active">
              <Check size={13} />
              <span>Preferences Saved</span>
            </div>
          ) : (
            <div className="live-preview-sync-badge">
              <Sparkles size={13} className="sparkle-icon" />
              <span>Active Preferences</span>
            </div>
          )}
        </div>

        <div className="live-preview-metrics">
          <div className="live-preview-metric">
            <Clock size={16} />
            <div>
              <span className="metric-label">Local Time ({timeFormat}-hr)</span>
              <strong className="metric-value">{timePreview}</strong>
            </div>
          </div>
          <div className="live-preview-divider" />
          <div className="live-preview-metric">
            <Calendar size={16} />
            <div>
              <span className="metric-label">Date Format</span>
              <strong className="metric-value">{datePreview}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="language-region__sections-grid">
        {/* Language */}
        <LanguageRegion.Section title="Language" className="lang-sec-1">
          <LanguageRegion.Select
            value={language}
            onChange={handleLanguageChange}
            options={languageOptions}
            ariaLabel="Language"
          />
        </LanguageRegion.Section>

        {/* Timezone */}
        <LanguageRegion.Section title="Timezone" className="lang-sec-2">
          <LanguageRegion.Select
            value={timezone}
            onChange={handleTimezoneChange}
            options={timezoneOptions}
            ariaLabel="Timezone"
          />
        </LanguageRegion.Section>

        {/* Time Format */}
        <LanguageRegion.Section title="Time format" className="lang-sec-3">
          <LanguageRegion.RadioGroup
            name="time-format"
            value={timeFormat}
            onChange={handleTimeFormatChange}
            options={timeOptions}
          />
        </LanguageRegion.Section>

        {/* Date Format */}
        <LanguageRegion.Section title="Date format" className="lang-sec-4">
          <LanguageRegion.RadioGroup
            name="date-format"
            value={dateFormat}
            onChange={handleDateFormatChange}
            options={dateOptions}
          />
          <p className="language-region__preview">Preview: {datePreview}</p>
        </LanguageRegion.Section>

        {/* First Day */}
        <LanguageRegion.Section
          title="First day displayed on your calendars"
          className="lang-sec-5"
        >
          <LanguageRegion.RadioGroup
            name="first-day"
            value={firstDay}
            onChange={handleFirstDayChange}
            options={firstDayOptions}
          />
        </LanguageRegion.Section>
      </div>
    </LanguageRegion>
  );
};

export default LanguageRegionPage;