(() => {
    const ATTRIBUTION_KEY = "rv_attribution_v1";
    const CTA_KEY = "rv_last_cta_v1";
    const CUSTOMER_KEY = "rv_known_customer_v1";
    const TRACKED_QUERY_KEYS = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "gclid",
        "fbclid",
        "ref",
        "src"
    ];
    const STRIPE_PRODUCT_MAP = {
        "eVqfZa90F6La7SecHogbm09": "law_firm_starter_subscription",
        "bJe8wI0u90mM0pMePwgbm0a": "law_firm_growth_subscription",
        "4gMbIU5Ot6LaegC8r8gbm0b": "law_firm_setup",
        "7sY14g4Kp8Ti3BY36Ogbm0n": "k1_filing_system",
        "bJeaEQ3Gl3yYa0mcHogbm0l": "complete_document_checklist",
        "4gM3coekZ2uU7Se22Kgbm0m": "interview_prep_guide",
        "eVqdR24Kp6Lac8u0YGgbm01": "k1_visa_package_basic",
        "bJe5kw0u9edC2xU36Ogbm02": "k1_visa_package_premium",
        "28E9AMccR8Ti7Se9vcgbm03": "adjustment_of_status_basic",
        "6oU7sE7WBfhGgoK6j0gbm04": "adjustment_of_status_premium",
        "5kQcMY1ydb1qegC4aSgbm05": "interview_coaching_basic",
        "9B6eV6a4J6LaegC9vcgbm06": "interview_coaching_premium"
    };

    function safeRead(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeWrite(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // Ignore storage failures so the funnel still works without localStorage.
        }
    }

    function safeJsonParse(value) {
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function randomId() {
        return "rv-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    }

    function getExternalReferrer() {
        if (!document.referrer) {
            return "";
        }

        try {
            const referrer = new URL(document.referrer);
            if (referrer.host !== window.location.host) {
                return document.referrer;
            }
        } catch (error) {
            return document.referrer;
        }

        return "";
    }

    function getCurrentTouch() {
        const params = new URLSearchParams(window.location.search);
        const hasTrackedParams = TRACKED_QUERY_KEYS.some((key) => params.has(key));
        const referrer = getExternalReferrer();

        return {
            source: params.get("utm_source") || params.get("src") || params.get("ref") || (referrer ? "referral" : "direct"),
            medium: params.get("utm_medium") || (referrer ? "referral" : "direct"),
            campaign: params.get("utm_campaign") || "",
            content: params.get("utm_content") || "",
            term: params.get("utm_term") || "",
            gclid: params.get("gclid") || "",
            fbclid: params.get("fbclid") || "",
            referrer,
            landing_page: window.location.pathname + window.location.search,
            page_title: document.title,
            observed_at: new Date().toISOString(),
            has_tracked_params: hasTrackedParams ? "true" : "false"
        };
    }

    function getAttribution() {
        const existing = safeJsonParse(safeRead(ATTRIBUTION_KEY)) || {};
        const currentTouch = getCurrentTouch();
        const firstTouch = existing.first_touch || currentTouch;
        const visitorId = existing.visitor_id || randomId();

        const attribution = {
            visitor_id: visitorId,
            first_touch: firstTouch,
            last_touch: currentTouch,
            session_path: window.location.pathname + window.location.search
        };

        safeWrite(ATTRIBUTION_KEY, JSON.stringify(attribution));
        return attribution;
    }

    function sanitizeReferencePart(value, fallback = "na") {
        const cleaned = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 40);

        return cleaned || fallback;
    }

    function getKnownCustomer() {
        return safeJsonParse(safeRead(CUSTOMER_KEY)) || {};
    }

    function storeKnownCustomer(form) {
        const emailInput = form.querySelector('input[type="email"], input[name="email"], input[name="waitlist_email"]');
        const firstNameInput =
            form.querySelector('input[name="firstName"], input[name="first_name"], input[name="waitlist_name"]');
        const countryInput =
            form.querySelector('select[name="country"], select[name="beneficiary_country"], input[name="waitlist_country"], input[name="country"]');
        const stageInput =
            form.querySelector('select[name="case_stage"], select[name="waitlist_stage"]');

        const email = emailInput ? String(emailInput.value || "").trim() : "";
        const firstName = firstNameInput ? String(firstNameInput.value || "").trim() : "";
        const country = countryInput ? String(countryInput.value || "").trim() : "";
        const stage = stageInput ? String(stageInput.value || "").trim() : "";

        if (!email) {
            return;
        }

        safeWrite(
            CUSTOMER_KEY,
            JSON.stringify({
                email,
                first_name: firstName,
                country,
                stage,
                captured_at: new Date().toISOString(),
                source_page: window.location.pathname + window.location.search
            })
        );
    }

    function setHiddenValue(form, name, value) {
        let input = form.querySelector(`input[name="${name}"]`);

        if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            form.appendChild(input);
        }

        input.value = value || "";
    }

    function inferFormType(form) {
        if (form.dataset.formType) {
            return form.dataset.formType;
        }

        if (form.id === "checklist-form" || window.location.pathname.endsWith("/checklist.html")) {
            return "checklist";
        }

        if (form.id === "contact-form" || window.location.pathname.endsWith("/contact.html")) {
            return "contact";
        }

        if (window.location.pathname.endsWith("/update-pass.html")) {
            return "update_pass_waitlist";
        }

        return "generic";
    }

    function enrichForm(form, attribution) {
        const lastCta = safeJsonParse(safeRead(CTA_KEY)) || {};
        const formType = inferFormType(form);

        setHiddenValue(form, "visitor_id", attribution.visitor_id);
        setHiddenValue(form, "form_type", formType);
        setHiddenValue(form, "source_page", window.location.pathname);
        setHiddenValue(form, "source_title", document.title);
        setHiddenValue(form, "first_touch_source", attribution.first_touch.source);
        setHiddenValue(form, "first_touch_medium", attribution.first_touch.medium);
        setHiddenValue(form, "first_touch_campaign", attribution.first_touch.campaign);
        setHiddenValue(form, "first_touch_landing_page", attribution.first_touch.landing_page);
        setHiddenValue(form, "first_touch_referrer", attribution.first_touch.referrer);
        setHiddenValue(form, "last_touch_source", attribution.last_touch.source);
        setHiddenValue(form, "last_touch_medium", attribution.last_touch.medium);
        setHiddenValue(form, "last_touch_campaign", attribution.last_touch.campaign);
        setHiddenValue(form, "last_touch_page", attribution.last_touch.landing_page);
        setHiddenValue(form, "last_touch_referrer", attribution.last_touch.referrer);
        setHiddenValue(form, "last_cta_text", lastCta.text || "");
        setHiddenValue(form, "last_cta_href", lastCta.href || "");
        setHiddenValue(form, "last_cta_source_page", lastCta.source_page || "");
        setHiddenValue(form, "last_cta_clicked_at", lastCta.clicked_at || "");

        form.addEventListener("submit", () => {
            storeKnownCustomer(form);
            setHiddenValue(form, "submitted_at", new Date().toISOString());
        });
    }

    function getStripeProductSlug(anchor) {
        if (anchor.dataset.productName) {
            return sanitizeReferencePart(anchor.dataset.productName);
        }

        try {
            const stripeUrl = new URL(anchor.href);
            const productKey = stripeUrl.pathname.split("/").filter(Boolean).pop();
            return STRIPE_PRODUCT_MAP[productKey] || sanitizeReferencePart(anchor.textContent, "stripe_product");
        } catch (error) {
            return sanitizeReferencePart(anchor.textContent, "stripe_product");
        }
    }

    function buildClientReferenceId(attribution, productSlug) {
        const visitorPart = sanitizeReferencePart((attribution.visitor_id || "").split("-").slice(-1)[0], "visitor");
        const sourcePart = sanitizeReferencePart(attribution.first_touch && attribution.first_touch.source, "direct");
        const campaignPart = sanitizeReferencePart(attribution.first_touch && attribution.first_touch.campaign, "site");
        const pagePart = sanitizeReferencePart(window.location.pathname.replace(/\//g, "_"), "page");

        return [
            `v_${visitorPart}`,
            `p_${productSlug}`,
            `s_${sourcePart}`,
            `c_${campaignPart}`,
            `l_${pagePart}`,
        ].join("__").slice(0, 200);
    }

    function rewriteStripeLink(anchor, attribution) {
        try {
            const stripeUrl = new URL(anchor.href);
            const knownCustomer = getKnownCustomer();
            const productSlug = getStripeProductSlug(anchor);

            stripeUrl.searchParams.set("utm_source", attribution.first_touch.source || "direct");
            stripeUrl.searchParams.set("utm_medium", attribution.first_touch.medium || "direct");

            if (attribution.first_touch.campaign) {
                stripeUrl.searchParams.set("utm_campaign", attribution.first_touch.campaign);
            }

            stripeUrl.searchParams.set("utm_content", productSlug);
            stripeUrl.searchParams.set("client_reference_id", buildClientReferenceId(attribution, productSlug));

            if (knownCustomer.email) {
                stripeUrl.searchParams.set("prefilled_email", knownCustomer.email);
            }

            anchor.href = stripeUrl.toString();
        } catch (error) {
            // Ignore malformed links and leave the original href intact.
        }
    }

    function captureCtaClick(anchor) {
        const text = (anchor.textContent || "").trim().replace(/\s+/g, " ");
        const href = anchor.getAttribute("href") || "";

        if (!href || href.startsWith("#")) {
            return;
        }

        safeWrite(
            CTA_KEY,
            JSON.stringify({
                text,
                href,
                source_page: window.location.pathname + window.location.search,
                clicked_at: new Date().toISOString()
            })
        );
    }

    function initThankYouMessage() {
        const attribution = safeJsonParse(safeRead(ATTRIBUTION_KEY));
        const summary = document.querySelector("[data-attribution-summary]");

        if (!summary || !attribution || !attribution.first_touch) {
            return;
        }

        const campaign = attribution.first_touch.campaign;
        const source = attribution.first_touch.source;

        if (campaign) {
            summary.textContent = `You came in through ${campaign}. Your next best move is still the DIY path: checklist first, Filing System second.`;
            return;
        }

        if (source && source !== "direct") {
            summary.textContent = `You came in through ${source}. Your next best move is still the DIY path: checklist first, Filing System second.`;
        }
    }

    document.addEventListener("click", (event) => {
        const anchor = event.target.closest("a");
        if (anchor) {
            captureCtaClick(anchor);
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        const attribution = getAttribution();
        const forms = Array.from(document.querySelectorAll('form[action*="formsubmit.co"]'));
        const stripeLinks = Array.from(document.querySelectorAll('a[href*="buy.stripe.com"]'));

        forms.forEach((form) => enrichForm(form, attribution));
        stripeLinks.forEach((anchor) => rewriteStripeLink(anchor, attribution));
        initThankYouMessage();
    });
})();
