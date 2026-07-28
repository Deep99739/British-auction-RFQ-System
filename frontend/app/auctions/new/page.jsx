import { useMemo, useState } from "react";
import { Link } from "../../../src/router";
import AppShell from "../../components/AppShell";
import { DEMO_AUCTION_ID } from "../../data/demoAuctions";
import {
  createAuction,
  USE_API,
} from "../../services/auctionApi";

function localDateTimeValue(date) {
  // datetime-local expects wall-clock time rather than a UTC timestamp.
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function localDateValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function createInitialForm() {
  const now = Date.now();

  return {
    name: "",
    reference: "",
    origin: "",
    destination: "",
    bidStart: localDateTimeValue(new Date(now + 10 * 60_000)),
    bidClose: localDateTimeValue(new Date(now + 40 * 60_000)),
    forcedClose: localDateTimeValue(new Date(now + 70 * 60_000)),
    serviceDate: localDateValue(new Date(now + 7 * 24 * 60 * 60_000)),
    triggerWindow: "10",
    extensionDuration: "5",
    triggerType: "L1_CHANGE",
  };
}

const triggerOptions = [
  {
    value: "BID_RECEIVED",
    title: "Bid received",
    description: "Extend when any valid bid arrives in the final X minutes.",
  },
  {
    value: "ANY_RANK_CHANGE",
    title: "Any rank change",
    description: "Extend when a bid changes any supplier position.",
  },
  {
    value: "L1_CHANGE",
    title: "L1 supplier changes",
    description: "Extend only when a different supplier becomes the lowest.",
  },
];

export default function CreateAuctionPage() {
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [createdAuction, setCreatedAuction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setCreatedAuction(null);
    setServerError("");
  }

  const selectedTrigger = useMemo(
    () => triggerOptions.find((option) => option.value === form.triggerType),
    [form.triggerType]
  );

  function validate() {
    const nextErrors = {};

    if (!form.name.trim()) nextErrors.name = "Enter an RFQ name.";
    if (!form.reference.trim())
      nextErrors.reference = "Enter a reference ID.";
    if (!form.origin.trim()) nextErrors.origin = "Enter an origin.";
    if (!form.destination.trim())
      nextErrors.destination = "Enter a destination.";
    if (!form.bidStart) nextErrors.bidStart = "Select a bid start time.";
    if (!form.bidClose) nextErrors.bidClose = "Select a bid close time.";
    if (!form.forcedClose)
      nextErrors.forcedClose = "Select a forced close time.";

    if (
      form.bidStart &&
      form.bidClose &&
      new Date(form.bidStart) >= new Date(form.bidClose)
    ) {
      nextErrors.bidClose = "Bid close must be later than bid start.";
    }

    if (
      form.bidClose &&
      form.forcedClose &&
      new Date(form.forcedClose) <= new Date(form.bidClose)
    ) {
      nextErrors.forcedClose =
        "Forced close must be later than the initial bid close.";
    }

    if (Number(form.triggerWindow) <= 0)
      nextErrors.triggerWindow = "Enter at least 1 minute.";
    if (Number(form.extensionDuration) <= 0)
      nextErrors.extensionDuration = "Enter at least 1 minute.";

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setSubmitting(true);
      setServerError("");
      try {
        const auction = USE_API
          ? await createAuction({
              name: form.name,
              referenceId: form.reference,
              origin: form.origin,
              destination: form.destination,
              serviceDate: form.serviceDate,
              bidStartAt: new Date(form.bidStart).toISOString(),
              bidCloseAt: new Date(form.bidClose).toISOString(),
              forcedCloseAt: new Date(form.forcedClose).toISOString(),
              triggerWindowMinutes: Number(form.triggerWindow),
              extensionDurationMinutes: Number(form.extensionDuration),
              triggerType: form.triggerType,
              currency: "INR",
            })
          : { id: DEMO_AUCTION_ID, referenceId: form.reference };
        setCreatedAuction(auction);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        setServerError(error.message);
        if (error.details) {
          setErrors((current) => ({ ...current, ...error.details }));
        }
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <AppShell active="create">
      <div className="page-frame form-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Auctions</Link>
          <span aria-hidden="true">/</span>
          <span>Create RFQ</span>
        </nav>

        <header className="page-header compact-header">
          <div>
            <p className="eyebrow">New sourcing event</p>
            <h1>Create RFQ</h1>
            <p className="page-intro">
              Define the request, bidding schedule and extension rules.
            </p>
          </div>
        </header>

        {createdAuction && (
          <div className="success-banner" role="status">
            <div>
              <strong>RFQ created successfully</strong>
              <span>
                {USE_API
                  ? "The auction is stored and ready for supplier bids."
                  : "Preview mode validated the complete auction configuration."}
              </span>
            </div>
            <Link href={`/auctions/${createdAuction.id}`}>Open auction</Link>
          </div>
        )}

        {serverError && (
          <div className="inline-alert error-alert" role="alert">
            {serverError}
          </div>
        )}

        <form className="rfq-form" onSubmit={handleSubmit} noValidate>
          <div className="form-content">
            <section className="form-section" aria-labelledby="rfq-details">
              <div className="form-section-heading">
                <span>01</span>
                <div>
                  <h2 id="rfq-details">RFQ details</h2>
                  <p>Name the sourcing event and provide its service date.</p>
                </div>
              </div>

              <div className="field-grid">
                <div className="field-group">
                  <label htmlFor="name">RFQ name</label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="e.g. West Europe reefer allocation"
                    aria-describedby={errors.name ? "name-error" : undefined}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && (
                    <span className="field-error" id="name-error">
                      {errors.name}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="reference">Reference ID</label>
                  <input
                    id="reference"
                    name="reference"
                    value={form.reference}
                    onChange={updateField}
                    placeholder="e.g. BA-2026-015"
                    aria-describedby={
                      errors.reference ? "reference-error" : undefined
                    }
                    aria-invalid={Boolean(errors.reference)}
                  />
                  {errors.reference && (
                    <span className="field-error" id="reference-error">
                      {errors.reference}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="serviceDate">Pickup / service date</label>
                  <input
                    id="serviceDate"
                    name="serviceDate"
                    type="date"
                    value={form.serviceDate}
                    onChange={updateField}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="origin">Origin</label>
                  <input
                    id="origin"
                    name="origin"
                    value={form.origin}
                    onChange={updateField}
                    placeholder="e.g. Nhava Sheva, India"
                    aria-describedby={errors.origin ? "origin-error" : undefined}
                    aria-invalid={Boolean(errors.origin)}
                  />
                  {errors.origin && (
                    <span className="field-error" id="origin-error">
                      {errors.origin}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="destination">Destination</label>
                  <input
                    id="destination"
                    name="destination"
                    value={form.destination}
                    onChange={updateField}
                    placeholder="e.g. Rotterdam, Netherlands"
                    aria-describedby={
                      errors.destination ? "destination-error" : undefined
                    }
                    aria-invalid={Boolean(errors.destination)}
                  />
                  {errors.destination && (
                    <span className="field-error" id="destination-error">
                      {errors.destination}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="form-section" aria-labelledby="auction-schedule">
              <div className="form-section-heading">
                <span>02</span>
                <div>
                  <h2 id="auction-schedule">Auction schedule</h2>
                  <p>
                    Forced close is the absolute deadline and cannot be
                    exceeded.
                  </p>
                </div>
              </div>

              <div className="field-grid three-columns">
                <div className="field-group">
                  <label htmlFor="bidStart">Bid start</label>
                  <input
                    id="bidStart"
                    name="bidStart"
                    type="datetime-local"
                    value={form.bidStart}
                    onChange={updateField}
                    aria-describedby={
                      errors.bidStart ? "bid-start-error" : undefined
                    }
                    aria-invalid={Boolean(errors.bidStart)}
                  />
                  {errors.bidStart && (
                    <span className="field-error" id="bid-start-error">
                      {errors.bidStart}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="bidClose">Initial bid close</label>
                  <input
                    id="bidClose"
                    name="bidClose"
                    type="datetime-local"
                    value={form.bidClose}
                    onChange={updateField}
                    aria-describedby={
                      errors.bidClose ? "bid-close-error" : undefined
                    }
                    aria-invalid={Boolean(errors.bidClose)}
                  />
                  {errors.bidClose && (
                    <span className="field-error" id="bid-close-error">
                      {errors.bidClose}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="forcedClose">Forced bid close</label>
                  <input
                    id="forcedClose"
                    name="forcedClose"
                    type="datetime-local"
                    value={form.forcedClose}
                    onChange={updateField}
                    aria-describedby={
                      errors.forcedClose ? "forced-close-error" : undefined
                    }
                    aria-invalid={Boolean(errors.forcedClose)}
                  />
                  {errors.forcedClose && (
                    <span className="field-error" id="forced-close-error">
                      {errors.forcedClose}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="form-section" aria-labelledby="extension-rules">
              <div className="form-section-heading">
                <span>03</span>
                <div>
                  <h2 id="extension-rules">Extension rules</h2>
                  <p>
                    Choose the activity that should prevent last-second
                    bidding.
                  </p>
                </div>
              </div>

              <div className="field-grid rule-numbers">
                <div className="field-group">
                  <label htmlFor="triggerWindow">Trigger window (X)</label>
                  <div className="number-field">
                    <input
                      id="triggerWindow"
                      name="triggerWindow"
                      type="number"
                      min="1"
                      value={form.triggerWindow}
                      onChange={updateField}
                      aria-describedby={
                        errors.triggerWindow
                          ? "trigger-window-error"
                          : "trigger-window-help"
                      }
                      aria-invalid={Boolean(errors.triggerWindow)}
                    />
                    <span>minutes</span>
                  </div>
                  <span className="field-help" id="trigger-window-help">
                    Monitor activity inside the final X minutes.
                  </span>
                  {errors.triggerWindow && (
                    <span className="field-error" id="trigger-window-error">
                      {errors.triggerWindow}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="extensionDuration">
                    Extension duration (Y)
                  </label>
                  <div className="number-field">
                    <input
                      id="extensionDuration"
                      name="extensionDuration"
                      type="number"
                      min="1"
                      value={form.extensionDuration}
                      onChange={updateField}
                      aria-describedby={
                        errors.extensionDuration
                          ? "extension-duration-error"
                          : "extension-duration-help"
                      }
                      aria-invalid={Boolean(errors.extensionDuration)}
                    />
                    <span>minutes</span>
                  </div>
                  <span className="field-help" id="extension-duration-help">
                    Add Y minutes when the selected trigger occurs.
                  </span>
                  {errors.extensionDuration && (
                    <span className="field-error" id="extension-duration-error">
                      {errors.extensionDuration}
                    </span>
                  )}
                </div>
              </div>

              <fieldset className="trigger-fieldset">
                <legend>Extension trigger</legend>
                <div className="trigger-options">
                  {triggerOptions.map((option) => (
                    <label
                      className={`trigger-option ${
                        form.triggerType === option.value ? "is-checked" : ""
                      }`}
                      key={option.value}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value={option.value}
                        checked={form.triggerType === option.value}
                        onChange={updateField}
                      />
                      <span>
                        <strong>{option.title}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          </div>

          <aside className="form-aside" aria-label="Auction rule preview">
            <div className="sticky-summary">
              <p className="summary-kicker">Rule preview</p>
              <h2>How this auction will close</h2>
              <p className="rule-preview-copy">
                During the final <strong>{form.triggerWindow} minutes</strong>,
                the auction will watch for{" "}
                <strong>{selectedTrigger?.title.toLowerCase()}</strong>.
              </p>
              <p className="rule-preview-copy">
                When triggered, the close moves by{" "}
                <strong>{form.extensionDuration} minutes</strong>, but never
                later than the forced close.
              </p>

              <dl className="summary-list">
                <div>
                  <dt>Initial close</dt>
                  <dd>
                    {form.bidClose
                      ? new Date(form.bidClose).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Not selected"}
                  </dd>
                </div>
                <div>
                  <dt>Forced close</dt>
                  <dd>
                    {form.forcedClose
                      ? new Date(form.forcedClose).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Not selected"}
                  </dd>
                </div>
              </dl>

              <div className="form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create RFQ"}
                </button>
                <Link className="secondary-button" href="/">
                  Cancel
                </Link>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
