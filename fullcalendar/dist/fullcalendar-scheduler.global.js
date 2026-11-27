/*!
FullCalendar Scheduler (Vanilla JS) v7.1.5
Docs & License: https://fullcalendar.io/docs/premium
(c) 2026 Adam Shaw
*/
(function (protectedApi, dayGridPlugin, jsxRuntime, publicApi, classNames, compat, timeGridPlugin) {
    'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var dayGridPlugin__default = /*#__PURE__*/_interopDefaultLegacy(dayGridPlugin);
    var classNames__default = /*#__PURE__*/_interopDefaultLegacy(classNames);
    var timeGridPlugin__default = /*#__PURE__*/_interopDefaultLegacy(timeGridPlugin);

    function identity(raw) {
        return raw;
    }

    const PRIVATE_ID_PREFIX = '_fc:';
    const RESOURCE_REFINERS = {
        id: String,
        parentId: String,
        children: identity,
        title: String,
        businessHours: identity,
        extendedProps: identity,
        // event-ui
        eventEditable: Boolean,
        eventStartEditable: Boolean,
        eventDurationEditable: Boolean,
        eventConstraint: identity,
        eventOverlap: Boolean, // can NOT be a func, different from OptionsInput
        eventAllow: identity,
        eventClass: protectedApi.refineClassName,
        eventColor: String,
        eventContrastColor: String,
    };
    /*
    needs a full store so that it can populate children too
    */
    function parseResource(raw, parentId = '', store, context) {
        let { refined, extra } = protectedApi.refineProps(raw, RESOURCE_REFINERS);
        let resource = {
            id: refined.id || (PRIVATE_ID_PREFIX + protectedApi.guid()),
            parentId: refined.parentId || parentId,
            title: refined.title || '',
            businessHours: refined.businessHours ? protectedApi.parseBusinessHours(refined.businessHours, context) : null,
            ui: protectedApi.createEventUi({
                editable: refined.eventEditable,
                startEditable: refined.eventStartEditable,
                durationEditable: refined.eventDurationEditable,
                constraint: refined.eventConstraint,
                overlap: refined.eventOverlap,
                allow: refined.eventAllow,
                className: refined.eventClass,
                color: refined.eventColor,
                contrastColor: refined.eventContrastColor,
            }, context),
            extendedProps: {
                ...extra,
                ...refined.extendedProps,
            },
        };
        // help out ResourceApi from having user modify props
        Object.freeze(resource.ui.className); // might be simple string, but freeze still works
        Object.freeze(resource.extendedProps);
        if (!store[resource.id]) { // no duplicate resource ID?
            store[resource.id] = resource;
            if (refined.children) {
                for (let childInput of refined.children) {
                    parseResource(childInput, resource.id, store, context);
                }
            }
        }
        return resource;
    }
    /*
    TODO: use this in more places
    */
    function getPublicId(id) {
        if (id.indexOf(PRIVATE_ID_PREFIX) === 0) {
            return '';
        }
        return id;
    }

    class ResourceApi {
        constructor(_context, _resource) {
            this._context = _context;
            this._resource = _resource;
        }
        setProp(name, value) {
            let oldResource = this._resource;
            this._context.dispatch({
                type: 'SET_RESOURCE_PROP',
                resourceId: oldResource.id,
                propName: name,
                propValue: value,
            });
            this.sync(oldResource);
        }
        setExtendedProp(name, value) {
            let oldResource = this._resource;
            this._context.dispatch({
                type: 'SET_RESOURCE_EXTENDED_PROP',
                resourceId: oldResource.id,
                propName: name,
                propValue: value,
            });
            this.sync(oldResource);
        }
        sync(oldResource) {
            let context = this._context;
            let resourceId = oldResource.id;
            // TODO: what if dispatch didn't complete synchronously?
            this._resource = context.getCurrentData().resourceStore[resourceId];
            context.emitter.trigger('resourceChange', {
                oldResource: new ResourceApi(context, oldResource),
                resource: this,
                revert() {
                    context.dispatch({
                        type: 'ADD_RESOURCE', // function as a merge. TODO: rename
                        resourceHash: {
                            [resourceId]: oldResource,
                        },
                    });
                },
            });
        }
        remove() {
            let context = this._context;
            let internalResource = this._resource;
            let resourceId = internalResource.id;
            context.dispatch({
                type: 'REMOVE_RESOURCE',
                resourceId,
            });
            context.emitter.trigger('resourceRemove', {
                resource: this,
                revert() {
                    context.dispatch({
                        type: 'ADD_RESOURCE', // function as a merge. TODO: rename
                        resourceHash: {
                            [resourceId]: internalResource,
                        },
                    });
                },
            });
        }
        getParent() {
            let context = this._context;
            let parentId = this._resource.parentId;
            if (parentId) {
                return new ResourceApi(context, context.getCurrentData().resourceStore[parentId]);
            }
            return null;
        }
        getChildren() {
            let thisResourceId = this._resource.id;
            let context = this._context;
            let { resourceStore } = context.getCurrentData();
            let childApis = [];
            for (let resourceId in resourceStore) {
                if (resourceStore[resourceId].parentId === thisResourceId) {
                    childApis.push(new ResourceApi(context, resourceStore[resourceId]));
                }
            }
            return childApis;
        }
        /*
        this is really inefficient!
        TODO: make EventApi::resourceIds a hash or keep an index in the Calendar's state
        */
        getEvents() {
            let thisResourceId = this._resource.id;
            let context = this._context;
            let { defs, instances } = context.getCurrentData().eventStore;
            let eventApis = [];
            for (let instanceId in instances) {
                let instance = instances[instanceId];
                let def = defs[instance.defId];
                if (def.resourceIds.indexOf(thisResourceId) !== -1) { // inefficient!!!
                    eventApis.push(new protectedApi.EventImpl(context, def, instance));
                }
            }
            return eventApis;
        }
        get id() { return getPublicId(this._resource.id); }
        get title() { return this._resource.title; }
        get eventConstraint() { return this._resource.ui.constraints[0] || null; } // TODO: better type
        get eventOverlap() { return this._resource.ui.overlap; }
        get eventAllow() { return this._resource.ui.allows[0] || null; } // TODO: better type
        get eventColor() { return this._resource.ui.color; }
        get eventContrastColor() { return this._resource.ui.contrastColor; }
        // NOTE: user can't modify these because Object.freeze was called in event-def parsing
        get eventClass() { return this._resource.ui.className; }
        get extendedProps() { return this._resource.extendedProps; }
        toPlainObject(settings = {}) {
            let internal = this._resource;
            let { ui } = internal;
            let publicId = this.id;
            let res = {};
            if (publicId) {
                res.id = publicId;
            }
            if (internal.title) {
                res.title = internal.title;
            }
            if (ui.color) {
                res.eventColor = ui.color;
            }
            if (ui.contrastColor) {
                res.eventContrastColor = ui.contrastColor;
            }
            if (ui.className) {
                res.eventClass = ui.className;
            }
            if (Object.keys(internal.extendedProps).length) {
                if (settings.collapseExtendedProps) {
                    Object.assign(res, internal.extendedProps);
                }
                else {
                    res.extendedProps = internal.extendedProps;
                }
            }
            return res;
        }
        toJSON() {
            return this.toPlainObject();
        }
    }
    function buildResourceApis(resourceStore, context) {
        let resourceApis = [];
        for (let resourceId in resourceStore) {
            resourceApis.push(new ResourceApi(context, resourceStore[resourceId]));
        }
        return resourceApis;
    }

    const EVENT_REFINERS = {
        resourceId: String,
        resourceIds: protectedApi.identity,
        resourceEditable: Boolean,
    };
    function generateEventDefResourceMembers(refined) {
        return {
            resourceIds: ensureStringArray(refined.resourceIds)
                .concat(refined.resourceId ? [refined.resourceId] : []),
            resourceEditable: refined.resourceEditable,
        };
    }
    function ensureStringArray(items) {
        return (items || []).map((item) => String(item));
    }

    protectedApi.EventImpl.prototype.getResources = function () {
        let { calendarApi } = this._context;
        // leaves out ids of resources that don't exist, or haven't been fetched yet
        return this._def.resourceIds
            .map((resourceId) => calendarApi.getResourceById(resourceId))
            .filter(Boolean);
    };
    protectedApi.EventImpl.prototype.setResources = function (resources) {
        let resourceIds = [];
        // massage resources -> resourceIds
        for (let resource of resources) {
            let resourceId = null;
            if (typeof resource === 'string') {
                resourceId = resource;
            }
            else if (typeof resource === 'number') {
                resourceId = String(resource);
            }
            else if (resource instanceof ResourceApi) {
                resourceId = resource.id; // guaranteed to always have an ID. hmmm
            }
            else {
                protectedApi.warn(`Invalid resource value \`${resource}\`. Expected a resource ID or ResourceApi object.`);
            }
            if (resourceId) {
                resourceIds.push(resourceId);
            }
        }
        this.mutate({
            standardProps: {
                resourceIds,
            },
        });
    };
    // core's setProp doesn't know about the scheduler's event props (#5166)
    const origSetProp = protectedApi.EventImpl.prototype.setProp;
    protectedApi.EventImpl.prototype.setProp = function (name, val) {
        if (name === 'resourceEditable') {
            this.mutate({
                standardProps: {
                    resourceEditable: EVENT_REFINERS.resourceEditable(val),
                },
            });
        }
        else {
            origSetProp.call(this, name, val);
        }
    };

    protectedApi.CalendarApiImpl.prototype.addResource = function (input, scrollTo = true) {
        let currentState = this.getCurrentData();
        let resourceHash;
        let resource;
        if (input instanceof ResourceApi) {
            resource = input._resource;
            resourceHash = { [resource.id]: resource };
        }
        else {
            resourceHash = {};
            resource = parseResource(input, '', resourceHash, currentState);
        }
        this.dispatch({
            type: 'ADD_RESOURCE',
            resourceHash,
        });
        if (scrollTo) {
            // TODO: wait til dispatch completes somehow
            this.trigger('_resourceScrollRequest', resource.id);
        }
        let resourceApi = new ResourceApi(currentState, resource);
        currentState.emitter.trigger('resourceAdd', {
            resource: resourceApi,
            revert: () => {
                this.dispatch({
                    type: 'REMOVE_RESOURCE',
                    resourceId: resource.id,
                });
            },
        });
        return resourceApi;
    };
    protectedApi.CalendarApiImpl.prototype.getResourceById = function (id) {
        id = String(id);
        let currentState = this.getCurrentData(); // eslint-disable-line react/no-this-in-sfc
        if (currentState.resourceStore) { // guard against calendar with no resource functionality
            let rawResource = currentState.resourceStore[id];
            if (rawResource) {
                return new ResourceApi(currentState, rawResource);
            }
        }
        return null;
    };
    protectedApi.CalendarApiImpl.prototype.getResources = function () {
        let currentState = this.getCurrentData();
        let { resourceStore } = currentState;
        let resourceApis = [];
        if (resourceStore) { // guard against calendar with no resource functionality
            for (let resourceId in resourceStore) {
                resourceApis.push(new ResourceApi(currentState, resourceStore[resourceId]));
            }
        }
        return resourceApis;
    };
    protectedApi.CalendarApiImpl.prototype.getTopLevelResources = function () {
        let currentState = this.getCurrentData();
        let { resourceStore } = currentState;
        let resourceApis = [];
        if (resourceStore) { // guard against calendar with no resource functionality
            for (let resourceId in resourceStore) {
                if (!resourceStore[resourceId].parentId) {
                    resourceApis.push(new ResourceApi(currentState, resourceStore[resourceId]));
                }
            }
        }
        return resourceApis;
    };
    protectedApi.CalendarApiImpl.prototype.refetchResources = function () {
        this.dispatch({
            type: 'REFETCH_RESOURCES',
        });
    };
    function transformDatePoint(dateSpan, context) {
        return dateSpan.resourceId ?
            { resource: context.calendarApi.getResourceById(dateSpan.resourceId) } :
            {};
    }
    function transformDateSpan(dateSpan, context) {
        return dateSpan.resourceId ?
            { resource: context.calendarApi.getResourceById(dateSpan.resourceId) } :
            {};
    }

    const UPGRADE_WINDOW = 365 + 7; // days. 1 week leeway, for tz shift reasons too
    const INVALID_LICENSE_URL = 'https://fullcalendar.io/docs/schedulerLicenseKey#invalid';
    const OUTDATED_LICENSE_URL = 'https://fullcalendar.io/docs/schedulerLicenseKey#outdated';
    const PRESET_LICENSE_KEYS = [
        'AGPL-My-Frontend-And-Backend-Are-Open-Source',
        'CC-Attribution-NonCommercial-NoDerivatives',
    ];
    function buildLicenseWarning(context) {
        const { options, pluginHooks } = context;
        const key = options.schedulerLicenseKey;
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        if (!isImmuneUrl(currentUrl)) {
            const status = processLicenseKey(key, pluginHooks.premiumReleaseDate);
            let statusText;
            let statusUrl;
            if (status === 'outdated') {
                statusText = 'Your license key is too old to work with this version.';
                statusUrl = OUTDATED_LICENSE_URL;
            }
            else {
                statusText = 'Your license key is invalid.';
                statusUrl = INVALID_LICENSE_URL;
            }
            if (status !== 'valid') {
                /*
                Deliberately styled with `popoverClass` and given no class option of its own.
                Anyone styling popovers has to style this banner too, so the class system can't be used to
                hide it without also hiding real popovers.
                */
                return (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.popoverClass, classNames__default["default"].popoverZ, classNames__default["default"].abs, classNames__default["default"].noPadding), style: {
                        bottom: 0,
                        left: 0, // TODO: use direction-aware start
                        minWidth: 'auto',
                    }, children: jsxRuntime.jsxs("div", { style: {
                            padding: '5px',
                            fontSize: '12px',
                            lineHeight: '1em',
                        }, children: [statusText, ' ', jsxRuntime.jsx("a", { href: statusUrl, target: '_blank', style: {
                                    textDecoration: 'underline',
                                }, children: "More info" })] }) }));
            }
        }
        return null;
    }
    /*
    This decryption is not meant to be bulletproof. Just a way to remind about an upgrade.
    */
    function processLicenseKey(key, premiumReleaseDate) {
        if (PRESET_LICENSE_KEYS.indexOf(key) !== -1) {
            return 'valid';
        }
        const parts = (key || '').match(/^(\d+)-fcs-(\d+)$/);
        if (parts && (parts[1].length === 10)) {
            const purchaseDate = new Date(parseInt(parts[2], 10) * 1000);
            const releaseDate = protectedApi.config.mockSchedulerReleaseDate || premiumReleaseDate;
            if (protectedApi.isValidDate(releaseDate)) { // token won't be replaced in dev mode
                const minPurchaseDate = protectedApi.addDays(releaseDate, -UPGRADE_WINDOW);
                if (minPurchaseDate < purchaseDate) {
                    return 'valid';
                }
                return 'outdated';
            }
        }
        return 'invalid';
    }
    function isImmuneUrl(url) {
        return /\w+:\/\/fullcalendar\.io\/|\/examples\/[\w-]+\.html$/.test(url);
    }

    const OPTION_REFINERS = {
        // Premium Common
        // --------------
        /**
         * The license key that unlocks premium features. Without a valid key, premium views display a
         * license warning.
         * @see https://fullcalendar.io/docs/schedulerLicenseKey
         */
        schedulerLicenseKey: String,
        /**
         * Whether to render only the rows and columns visible in the scroll viewport, which speeds up
         * calendars with many resources. Currently applies to resource timeline views.
         * @see https://fullcalendar.io/docs/virtualization
         */
        virtualization: Boolean,
        // Resource
        // --------
        /**
         * Resources to load when the calendar initializes, in any form `resources` accepts. Unlike
         * `resources`, later changes to this value are ignored, so resources can then be managed through
         * the API.
         * @see https://fullcalendar.io/docs/initialResources
         */
        initialResources: protectedApi.identity,
        /**
         * The calendar's resources: an array of resource objects, a JSON feed URL, a function that supplies
         * resources, or a resource source object.
         * @see https://fullcalendar.io/docs/resource-data
         */
        resources: protectedApi.identity,
        /**
         * Whether the user can drag events from one resource to another. Defaults to the value of
         * `editable`; requires the interaction plugin.
         * @see https://fullcalendar.io/docs/eventResourceEditable
         */
        eventResourceEditable: Boolean,
        /**
         * Whether to refetch resources whenever the date range or view changes. When `true`, resource feeds
         * and functions receive the start, end, and time zone of the range.
         * @see https://fullcalendar.io/docs/refetchResourcesOnNavigate
         */
        refetchResourcesOnNavigate: Boolean,
        /**
         * The sort order of resources: resource field names (prefix with `-` for descending) as a
         * comma-separated string or array, or a comparison function. Defaults to `'id,title'`.
         * @see https://fullcalendar.io/docs/resourceOrder
         */
        resourceOrder: protectedApi.parseFieldSpecs,
        /**
         * Whether to display only resources that have events in the current date range. No resources
         * appear until events have loaded.
         * @see https://fullcalendar.io/docs/filterResourcesWithEvents
         */
        filterResourcesWithEvents: Boolean,
        /**
         * In resource timeline views, groups resources by the value of this resource field, with a
         * header row above each group. Ignored if any `resourceColumns` entry has `group: true`.
         * @see https://fullcalendar.io/docs/resourceGroupField
         */
        resourceGroupField: String,
        /**
         * Whether child resources start out expanded in resource timeline views. When `false`, they are
         * collapsed until the user expands their parent.
         * @see https://fullcalendar.io/docs/resourcesInitiallyExpanded
         */
        resourcesInitiallyExpanded: Boolean,
        /**
         * Whether vertical resource views put the date headers above the resource headers, instead of
         * resources above dates.
         * @see https://fullcalendar.io/docs/datesAboveResources
         */
        datesAboveResources: Boolean,
        needsResourceData: Boolean, // internal-only
        // Resource DayGrid
        // ----------------
        /**
         * Class names for a header cell naming one resource, above its column(s) in resource time grid and
         * day grid views. A string, or a function that receives `ResourceDayHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the text wrapper inside a resource header cell. A string, or a function that
         * receives `ResourceDayHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderInnerClass: protectedApi.refineClassNameGenerator,
        /**
         * Custom content for each `resourceDayHeader` part, injected inside it in place of its default
         * content.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderContent: protectedApi.identity,
        /**
         * Called right after each `resourceDayHeader` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceDayHeader` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderWillUnmount: protectedApi.identity,
        /**
         * The horizontal alignment of resource header text: `'start'`, `'center'`, or `'end'`, or a
         * function of the header's `level` that returns one. Themes set their own default.
         * @see https://fullcalendar.io/docs/resource-day-header-render-hooks
         */
        resourceDayHeaderAlign: protectedApi.identity,
        // stickiness for cell-inner-contents laterally. experimental settings
        _resourceDayHeaderSticky: protectedApi.identity,
        // Resource Timeline
        // -----------------
        /**
         * The maximum number of resource rows rendered when printing a resource timeline view. Printing
         * requires the premium adaptive plugin.
         * @see https://fullcalendar.io/docs/printMaxRows
         */
        printMaxRows: Number,
        /**
         * The width of the resource area in resource timeline views, as a number of pixels or a string
         * ending in `px` or `%`. Defaults to `'30%'`.
         * @see https://fullcalendar.io/docs/resourceColumnsWidth
         */
        resourceColumnsWidth: protectedApi.identity,
        /**
         * Turns the resource area of resource timeline views into a grid of data columns. An array of
         * column objects, each typically with a `field` from the resource, and optionally a
         * `headerContent`, `width`, or `group: true`.
         * @see https://fullcalendar.io/docs/resourceColumns
         */
        resourceColumns: protectedApi.identity,
        /**
         * Class names for the line between the resource area and the timeline. A string only; functions are
         * not accepted.
         * @see https://fullcalendar.io/docs/resource-column-divider-render-hooks
         */
        resourceColumnDividerClass: protectedApi.refineClassName,
        // datagrid super-header & normal column headers
        /**
         * Class names for the header of one resource area column ("Resources" by default). A string, or a
         * function that receives `ResourceColumnHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnHeaderClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the text wrapper inside a resource column header. A string, or a function that
         * receives `ResourceColumnHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnHeaderInnerClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the drag handle for resizing a resource area column. A string, or a function that
         * receives `ResourceColumnHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnResizerClass: protectedApi.refineClassNameGenerator,
        /**
         * Custom content for each `resourceColumnHeader` part, injected inside it in place of its default
         * content.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnHeaderContent: protectedApi.identity,
        /**
         * Called right after each `resourceColumnHeader` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnHeaderDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceColumnHeader` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-column-header-render-hooks
         */
        resourceColumnHeaderWillUnmount: protectedApi.identity,
        /**
         * Class names for a header row of the resource area, on the left of resource timeline views. A string
         * only; functions are not accepted.
         * @see https://fullcalendar.io/docs/resource-header-row-render-hooks
         */
        resourceHeaderRowClass: protectedApi.refineClassName,
        // For both resources & resource groups
        /**
         * Class names for a row in the resource area, for a resource or a resource group. A string only;
         * functions are not accepted.
         * @see https://fullcalendar.io/docs/resource-row-render-hooks
         */
        resourceRowClass: protectedApi.refineClassName,
        // datagrid cells, for both resources & resource-GROUP
        /**
         * Class names for one cell of a resource row: the resource's title or another column's field. A
         * string, or a function that receives `ResourceCellInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-cell-render-hooks
         */
        resourceCellClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the content wrapper inside a resource cell. A string, or a function that receives
         * `ResourceCellInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-cell-render-hooks
         */
        resourceCellInnerClass: protectedApi.refineClassNameGenerator,
        /**
         * Custom content for each `resourceCell` part, injected inside it in place of its default content.
         * @see https://fullcalendar.io/docs/resource-cell-render-hooks
         */
        resourceCellContent: protectedApi.identity,
        /**
         * Called right after each `resourceCell` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-cell-render-hooks
         */
        resourceCellDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceCell` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-cell-render-hooks
         */
        resourceCellWillUnmount: protectedApi.identity,
        // datagrid, for resource-GROUP entire row
        /**
         * Class names for the name of a resource group, at the top of its rows in the resource area. A
         * string, or a function that receives `ResourceGroupHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-group-header-render-hooks
         */
        resourceGroupHeaderClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the text wrapper inside a resource group header. A string, or a function that
         * receives `ResourceGroupHeaderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-group-header-render-hooks
         */
        resourceGroupHeaderInnerClass: protectedApi.refineClassNameGenerator,
        /**
         * Custom content for each `resourceGroupHeader` part, injected inside it in place of its default
         * content.
         * @see https://fullcalendar.io/docs/resource-group-header-render-hooks
         */
        resourceGroupHeaderContent: protectedApi.identity,
        /**
         * Called right after each `resourceGroupHeader` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-group-header-render-hooks
         */
        resourceGroupHeaderDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceGroupHeader` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-group-header-render-hooks
         */
        resourceGroupHeaderWillUnmount: protectedApi.identity,
        // timeline lane, for resource-GROUP
        /**
         * Class names for a resource group's lane across the timeline, beside its header. A string, or a
         * function that receives `ResourceGroupLaneInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-group-lane-render-hooks
         */
        resourceGroupLaneClass: protectedApi.refineClassNameGenerator,
        /**
         * Class names for the wrapper inside a resource group lane. A string, or a function that receives
         * `ResourceGroupLaneInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-group-lane-render-hooks
         */
        resourceGroupLaneInnerClass: protectedApi.refineClassNameGenerator,
        /**
         * Content rendered inside each `resourceGroupLane` part, which is otherwise empty.
         * @see https://fullcalendar.io/docs/resource-group-lane-render-hooks
         */
        resourceGroupLaneContent: protectedApi.identity,
        /**
         * Called right after each `resourceGroupLane` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-group-lane-render-hooks
         */
        resourceGroupLaneDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceGroupLane` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-group-lane-render-hooks
         */
        resourceGroupLaneWillUnmount: protectedApi.identity,
        // timeline, lane, for resource
        /**
         * Class names for one resource's horizontal lane across the timeline, where its events appear. A
         * string, or a function that receives `ResourceLaneInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneClass: protectedApi.refineClassNameGenerator,
        /**
         * Called right after each `resourceLane` part's element is added to the DOM.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneDidMount: protectedApi.identity,
        /**
         * Called right before each `resourceLane` part's element is removed from the DOM.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneWillUnmount: protectedApi.identity,
        /**
         * Class names for the space above the events in a resource lane. A string, or a function that
         * receives `ResourceLaneInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneTopClass: protectedApi.refineClassNameGenerator,
        /**
         * Content rendered inside each resource lane's `resourceLaneTop` element, above its events, which
         * is otherwise empty.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneTopContent: protectedApi.identity,
        /**
         * Class names for the space below the events in a resource lane. A string, or a function that
         * receives `ResourceLaneInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneBottomClass: protectedApi.refineClassNameGenerator,
        /**
         * Content rendered inside each resource lane's `resourceLaneBottom` element, below its events,
         * which is otherwise empty.
         * @see https://fullcalendar.io/docs/resource-lane-render-hooks
         */
        resourceLaneBottomContent: protectedApi.identity,
        /**
         * Class names for the indentation before a nested resource, holding the expander. A string only;
         * functions are not accepted.
         * @see https://fullcalendar.io/docs/resource-expander-render-hooks
         */
        resourceIndentClass: protectedApi.refineClassName,
        /**
         * Class names for the toggle that expands or collapses a resource's children or a group. A string,
         * or a function that receives `ResourceExpanderInfo` and returns one.
         * @see https://fullcalendar.io/docs/resource-expander-render-hooks
         */
        resourceExpanderClass: protectedApi.refineClassNameGenerator,
        /**
         * Custom content for each `resourceExpander` part, injected inside it in place of its default
         * content.
         * @see https://fullcalendar.io/docs/resource-expander-render-hooks
         */
        resourceExpanderContent: protectedApi.identity,
        // Timeline
        // --------
        /**
         * Class names for the space above the events in a timeline without resources. A string only;
         * functions are not accepted.
         * @see https://fullcalendar.io/docs/timeline-render-hooks
         */
        timelineTopClass: protectedApi.refineClassName,
        /**
         * Class names for the space below the events in a timeline without resources. A string only;
         * functions are not accepted.
         * @see https://fullcalendar.io/docs/timeline-render-hooks
         */
        timelineBottomClass: protectedApi.refineClassName,
    };
    const OPTION_DEFAULTS = {
        // Resource Timeline
        // -----------------
        printMaxRows: 1000,
        // Resource DayGrid
        // ----------------
        // resourceDayHeaderAlign: 'start' as const, --- this default was inlined due to plugin ordering problems
        _resourceDayHeaderSticky: true,
    };
    const LISTENER_REFINERS = {
        // Resource
        // --------
        /**
         * Called after the calendar's resources are first loaded or change in any way, with an array of all
         * resources (the same as `getResources()`).
         * @see https://fullcalendar.io/docs/resourcesSet
         */
        resourcesSet: protectedApi.identity,
        /**
         * Called after a resource is added to the calendar via `addResource`. The info includes the
         * resource and `revert` to undo the addition.
         * @see https://fullcalendar.io/docs/resourceAdd
         */
        resourceAdd: protectedApi.identity,
        /**
         * Called after a resource is modified via its setter methods. The info includes the updated
         * resource, the previous `oldResource`, and `revert` to undo the change.
         * @see https://fullcalendar.io/docs/resourceChange
         */
        resourceChange: protectedApi.identity,
        /**
         * Called after a resource is removed from the calendar via `remove()`. The info includes the
         * resource and `revert` to undo the removal.
         * @see https://fullcalendar.io/docs/resourceRemove
         */
        resourceRemove: protectedApi.identity,
        // internal
        _resourceScrollRequest: protectedApi.identity,
    };

    var premiumCommonPlugin = {
        name: 'common',
        premiumReleaseDate: '2026-11-12',
        optionRefiners: OPTION_REFINERS,
        optionDefaults: OPTION_DEFAULTS,
        listenerRefiners: LISTENER_REFINERS,
        viewContainerAppends: [buildLicenseWarning],
    };

    function massageEventDragMutation(eventMutation, hit0, hit1) {
        let resource0 = hit0.dateSpan.resourceId;
        let resource1 = hit1.dateSpan.resourceId;
        if (resource0 && resource1 &&
            resource0 !== resource1) {
            eventMutation.resourceMutation = {
                matchResourceId: resource0,
                setResourceId: resource1,
            };
        }
    }
    /*
    TODO: all this would be much easier if we were using a hash!
    */
    function applyEventDefMutation(eventDef, mutation, context) {
        let resourceMutation = mutation.resourceMutation;
        if (resourceMutation && computeResourceEditable(eventDef, context)) {
            let index = eventDef.resourceIds.indexOf(resourceMutation.matchResourceId);
            if (index !== -1) {
                let resourceIds = eventDef.resourceIds.slice(); // copy
                resourceIds.splice(index, 1); // remove
                if (resourceIds.indexOf(resourceMutation.setResourceId) === -1) { // not already in there
                    resourceIds.push(resourceMutation.setResourceId); // add
                }
                eventDef.resourceIds = resourceIds;
            }
        }
    }
    /*
    HACK
    TODO: use EventUi system instead of this
    */
    function computeResourceEditable(eventDef, context) {
        let { resourceEditable } = eventDef;
        if (resourceEditable == null) {
            let source = eventDef.sourceId && context.getCurrentData().eventSources[eventDef.sourceId];
            if (source) {
                resourceEditable = source.extendedProps.resourceEditable; // used the Source::extendedProps hack
            }
            if (resourceEditable == null) {
                resourceEditable = context.options.eventResourceEditable;
                if (resourceEditable == null) {
                    resourceEditable = context.options.editable; // TODO: use defaults system instead
                }
            }
        }
        return resourceEditable;
    }
    function transformEventDrop(mutation, context, eventDef) {
        let { resourceMutation } = mutation;
        // like applyEventDefMutation, ignore the resource change when not resource-editable (#4943)
        if (resourceMutation && computeResourceEditable(eventDef, context)) {
            let { calendarApi } = context;
            return {
                oldResource: calendarApi.getResourceById(resourceMutation.matchResourceId),
                newResource: calendarApi.getResourceById(resourceMutation.setResourceId),
            };
        }
        return {
            oldResource: null,
            newResource: null,
        };
    }

    /*
    Passes resource data through untouched. filterResourcesWithEvents is applied by each view
    via resource/common/resource-filtering, so a view's whole visibility policy — view-wide and,
    for the vertical views, per-date — lives in one place instead of straddling this transformer.
    Views filter against rawEventStore so resources don't vanish while an event is being dragged.

    CONSEQUENCE: declaring `needsResourceData` no longer buys a view filtering for free. A new
    resource view must call filterResourceStore itself or filterResourcesWithEvents silently
    does nothing for it.
    */
    class ResourceDataAdder {
        transform(viewProps, calendarProps) {
            if (calendarProps.viewSpec.optionDefaults.needsResourceData) {
                return {
                    resourceStore: calendarProps.resourceStore,
                    rawEventStore: calendarProps.eventStore,
                    resourceEntityExpansions: calendarProps.resourceEntityExpansions,
                };
            }
            return null;
        }
    }
    /*
    for making sure events that have editable resources are always draggable in resource views
    */
    function transformIsDraggable(val, eventDef, eventUi, context) {
        if (!val) {
            let state = context.getCurrentData();
            let viewSpec = state.viewSpecs[state.currentViewType];
            if (viewSpec.optionDefaults.needsResourceData) {
                if (computeResourceEditable(eventDef, context)) {
                    return true;
                }
            }
        }
        return val;
    }

    /*
    For views without resources: each event gets its resources' UI (coloring, constraints, etc.).
    Views with resources get a resource's UI per section instead, from the splitter.
    */
    class ResourceEventConfigAdder {
        constructor() {
            this.buildResourceEventUis = protectedApi.memoize(buildResourceEventUis, protectedApi.isPropsEqualShallow);
            this.buildGetResourcesEventUi = protectedApi.memoize(buildGetResourcesEventUi); // changes only when a resource's UI does
            this.addGetExtraUi = protectedApi.memoize(addGetExtraUi);
        }
        transform(viewProps, calendarProps) {
            if (!calendarProps.viewSpec.optionDefaults.needsResourceData) {
                return {
                    eventUiBases: this.addGetExtraUi(viewProps.eventUiBases, this.buildGetResourcesEventUi(this.buildResourceEventUis(calendarProps.resourceStore))),
                };
            }
            return null;
        }
    }
    function buildResourceEventUis(resourceStore) {
        return protectedApi.mapHash(resourceStore, (resource) => resource.ui);
    }
    function buildGetResourcesEventUi(resourceEventUis) {
        return (eventDef) => {
            let { resourceIds } = eventDef;
            if (resourceIds.length === 1) {
                return resourceEventUis[resourceIds[0]];
            }
            let parts = [];
            // first resource takes precedence, which fights with the ordering of combineEventUis, thus the unshifts
            for (let resourceId of resourceIds) {
                if (resourceEventUis[resourceId]) {
                    parts.unshift(resourceEventUis[resourceId]);
                }
            }
            return parts.length ? protectedApi.combineEventUis(parts) : undefined;
        };
    }
    function addGetExtraUi(eventUiBases, getExtraUi) {
        return { ...eventUiBases, getExtraUi };
    }

    const arrayResourceSource = {
        ignoreRange: true,
        parseMeta(refined) {
            if (Array.isArray(refined.resources)) {
                return refined.resources;
            }
            return null;
        },
        fetch(arg, successCallback) {
            successCallback({
                rawResources: arg.resourceSource.meta,
            });
        },
    };

    const jsonFeedResourceSource = {
        parseMeta(refined) {
            if (refined.url) {
                return {
                    url: refined.url,
                    method: (refined.method || 'GET').toUpperCase(),
                    extraParams: refined.extraParams,
                };
            }
            return null;
        },
        fetch(arg, successCallback, errorCallback) {
            const meta = arg.resourceSource.meta;
            const requestParams = buildRequestParams(meta, arg.range, arg.context);
            protectedApi.requestJson(meta.method, meta.url, requestParams).then(([rawResources, response]) => {
                successCallback({ rawResources, response });
            }, errorCallback);
        },
    };
    // TODO: somehow consolidate with event json feed
    function buildRequestParams(meta, range, context) {
        let { dateEnv, options } = context;
        let startParam;
        let endParam;
        let timeZoneParam;
        let customRequestParams;
        let params = {};
        if (range) {
            startParam = meta.startParam;
            if (startParam == null) {
                startParam = options.startParam;
            }
            endParam = meta.endParam;
            if (endParam == null) {
                endParam = options.endParam;
            }
            timeZoneParam = meta.timeZoneParam;
            if (timeZoneParam == null) {
                timeZoneParam = options.timeZoneParam;
            }
            params[startParam] = dateEnv.formatIso(range.start);
            params[endParam] = dateEnv.formatIso(range.end);
            if (dateEnv.timeZone !== 'local') {
                params[timeZoneParam] = dateEnv.timeZone;
            }
        }
        // retrieve any outbound GET/POST data from the options
        if (typeof meta.extraParams === 'function') {
            // supplied as a function that returns a key/value object
            customRequestParams = meta.extraParams();
        }
        else {
            // probably supplied as a straight key/value object
            customRequestParams = meta.extraParams || {};
        }
        Object.assign(params, customRequestParams);
        return params;
    }

    const funcResourceSource = {
        parseMeta(refined) {
            if (typeof refined.resources === 'function') {
                return refined.resources;
            }
            return null;
        },
        fetch(info, successCallback, errorCallback) {
            const dateEnv = info.context.dateEnv;
            const func = info.resourceSource.meta;
            const publicData = info.range ? {
                start: dateEnv.toDate(info.range.start),
                end: dateEnv.toDate(info.range.end),
                startStr: dateEnv.formatIso(info.range.start),
                endStr: dateEnv.formatIso(info.range.end),
                timeZone: dateEnv.timeZone,
            } : {};
            protectedApi.unpromisify(func.bind(null, publicData), (rawResources) => successCallback({ rawResources }), errorCallback);
        },
    };

    let defs = [
        arrayResourceSource,
        jsonFeedResourceSource,
        funcResourceSource,
    ];
    function getResourceSourceDef(id) {
        return defs[id];
    }
    function getResourceSourceDefs() {
        return defs;
    }

    // TODO: make this a plugin-able parser
    // TODO: success/failure
    const RESOURCE_SOURCE_REFINERS = {
        id: String,
        // for array. TODO: move to resource-array
        resources: protectedApi.identity,
        // for json feed. TODO: move to resource-json-feed
        url: String,
        method: String,
        startParam: String,
        endParam: String,
        timeZoneParam: String,
        extraParams: protectedApi.identity,
    };
    function parseResourceSource(input) {
        let inputObj;
        if (typeof input === 'string') {
            inputObj = { url: input };
        }
        else if (typeof input === 'function' || Array.isArray(input)) {
            inputObj = { resources: input };
        }
        else if (typeof input === 'object' && input) { // non-null object
            inputObj = input;
        }
        if (inputObj) {
            let { refined, extra } = protectedApi.refineProps(inputObj, RESOURCE_SOURCE_REFINERS);
            warnUnknownProps(extra);
            let metaRes = buildResourceSourceMeta(refined);
            if (metaRes) {
                return {
                    _raw: input,
                    sourceId: protectedApi.guid(),
                    sourceDefId: metaRes.sourceDefId,
                    meta: metaRes.meta,
                    publicId: refined.id || '',
                    isFetching: false,
                    latestFetchId: '',
                    fetchRange: null,
                };
            }
        }
        return null;
    }
    function buildResourceSourceMeta(refined) {
        let defs = getResourceSourceDefs();
        for (let i = defs.length - 1; i >= 0; i -= 1) { // later-added plugins take precedence
            let def = defs[i];
            let meta = def.parseMeta(refined);
            if (meta) {
                return { meta, sourceDefId: i };
            }
        }
        return null;
    }
    function warnUnknownProps(props) {
        for (let propName in props) {
            protectedApi.warn(`Unknown resource-source property \`${propName}\`.`);
        }
    }

    function reduceResourceSource(source, action, context) {
        let { options, dateProfile } = context;
        if (!source || !action) {
            return createSource(options.initialResources || options.resources, dateProfile.activeRange, options.refetchResourcesOnNavigate, context);
        }
        switch (action.type) {
            case 'RESET_RESOURCE_SOURCE':
                return createSource(action.resourceSourceInput, dateProfile.activeRange, options.refetchResourcesOnNavigate, context);
            case 'PREV': // TODO: how do we track all actions that affect dateProfile :(
            case 'NEXT':
            case 'CHANGE_DATE':
            case 'CHANGE_VIEW_TYPE':
                return handleRangeChange(source, dateProfile.activeRange, options.refetchResourcesOnNavigate, context);
            case 'RECEIVE_RESOURCES':
            case 'RECEIVE_RESOURCE_ERROR':
                return receiveResponse(source, action.fetchId, action.fetchRange);
            case 'REFETCH_RESOURCES':
                return fetchSource(source, dateProfile.activeRange, context);
            default:
                return source;
        }
    }
    function createSource(input, activeRange, refetchResourcesOnNavigate, context) {
        if (input) {
            let source = parseResourceSource(input);
            source = fetchSource(source, refetchResourcesOnNavigate ? activeRange : null, context);
            return source;
        }
        return null;
    }
    function handleRangeChange(source, activeRange, refetchResourcesOnNavigate, context) {
        if (refetchResourcesOnNavigate &&
            !doesSourceIgnoreRange(source) &&
            (!source.fetchRange || !protectedApi.rangesEqual(source.fetchRange, activeRange))) {
            return fetchSource(source, activeRange, context);
        }
        return source;
    }
    function doesSourceIgnoreRange(source) {
        return Boolean(getResourceSourceDef(source.sourceDefId).ignoreRange);
    }
    function fetchSource(source, fetchRange, context) {
        let sourceDef = getResourceSourceDef(source.sourceDefId);
        let fetchId = protectedApi.guid();
        sourceDef.fetch({
            resourceSource: source,
            range: fetchRange,
            context,
        }, (res) => {
            context.dispatch({
                type: 'RECEIVE_RESOURCES',
                fetchId,
                fetchRange,
                rawResources: res.rawResources,
            });
        }, (error) => {
            context.dispatch({
                type: 'RECEIVE_RESOURCE_ERROR',
                fetchId,
                fetchRange,
                error,
            });
        });
        return {
            ...source,
            isFetching: true,
            latestFetchId: fetchId,
        };
    }
    function receiveResponse(source, fetchId, fetchRange) {
        if (fetchId === source.latestFetchId) {
            return {
                ...source,
                isFetching: false,
                fetchRange,
            };
        }
        return source;
    }

    function reduceResourceStore(store, action, source, context) {
        if (!store || !action) {
            return {};
        }
        switch (action.type) {
            case 'RECEIVE_RESOURCES':
                return receiveRawResources(store, action.rawResources, action.fetchId, source, context);
            case 'ADD_RESOURCE':
                return addResource(store, action.resourceHash);
            case 'REMOVE_RESOURCE':
                return removeResource(store, action.resourceId);
            case 'SET_RESOURCE_PROP':
                return setResourceProp(store, action.resourceId, action.propName, action.propValue);
            case 'SET_RESOURCE_EXTENDED_PROP':
                return setResourceExtendedProp(store, action.resourceId, action.propName, action.propValue);
            default:
                return store;
        }
    }
    function receiveRawResources(existingStore, inputs, fetchId, source, context) {
        if (source.latestFetchId === fetchId) {
            let nextStore = {};
            for (let input of inputs) {
                parseResource(input, '', nextStore, context);
            }
            return nextStore;
        }
        return existingStore;
    }
    function addResource(existingStore, additions) {
        // TODO: warn about duplicate IDs
        return { ...existingStore, ...additions };
    }
    function removeResource(existingStore, resourceId) {
        let newStore = { ...existingStore };
        delete newStore[resourceId];
        // promote children
        for (let childResourceId in newStore) { // a child, *maybe* but probably not
            if (newStore[childResourceId].parentId === resourceId) {
                newStore[childResourceId] = {
                    ...newStore[childResourceId],
                    parentId: '',
                };
            }
        }
        return newStore;
    }
    function setResourceProp(existingStore, resourceId, name, value) {
        let existingResource = existingStore[resourceId];
        // TODO: sanitization
        if (existingResource) {
            return {
                ...existingStore,
                [resourceId]: {
                    ...existingResource,
                    [name]: value,
                },
            };
        }
        return existingStore;
    }
    function setResourceExtendedProp(existingStore, resourceId, name, value) {
        let existingResource = existingStore[resourceId];
        if (existingResource) {
            return {
                ...existingStore,
                [resourceId]: {
                    ...existingResource,
                    extendedProps: {
                        ...existingResource.extendedProps,
                        [name]: value,
                    },
                },
            };
        }
        return existingStore;
    }

    function reduceResourceEntityExpansions(expansions, action) {
        if (!expansions || !action) {
            return {};
        }
        switch (action.type) {
            case 'SET_RESOURCE_ENTITY_EXPANDED':
                return {
                    ...expansions,
                    [action.id]: action.isExpanded,
                };
            default:
                return expansions;
        }
    }

    function reduceResources(state, action, context) {
        let resourceSource = reduceResourceSource(state && state.resourceSource, action, context);
        let resourceStore = reduceResourceStore(state && state.resourceStore, action, resourceSource, context);
        let resourceEntityExpansions = reduceResourceEntityExpansions(state && state.resourceEntityExpansions, action);
        return {
            resourceSource,
            resourceStore,
            resourceEntityExpansions,
        };
    }

    function transformDateSelectionJoin(hit0, hit1) {
        let resourceId0 = hit0.dateSpan.resourceId;
        let resourceId1 = hit1.dateSpan.resourceId;
        if (resourceId0 && resourceId1) {
            return { resourceId: resourceId0 };
        }
        return null;
    }

    /*
    splits things BASED OFF OF which resources they are associated with.
    creates a '' entry which is when something has NO resource.
    */
    class ResourceSplitter extends protectedApi.Splitter {
        getKeyInfo(props) {
            return {
                '': {}, // needed for non-resource
                ...props.resourceStore, // already has `ui` and `businessHours` keys!
            };
        }
        getKeysForDateSpan(dateSpan) {
            return [dateSpan.resourceId || ''];
        }
        getKeysForEventDef(eventDef) {
            let resourceIds = eventDef.resourceIds;
            if (!resourceIds.length) {
                return [''];
            }
            return resourceIds;
        }
    }

    function isPropsValidWithResources(combinedProps, context) {
        let splitter = new ResourceSplitter();
        let sets = splitter.splitProps({
            ...combinedProps,
            resourceStore: context.getCurrentData().resourceStore,
        });
        for (let resourceId in sets) {
            let props = sets[resourceId];
            // merge in event data from the non-resource segment
            if (resourceId && sets['']) { // current segment is not the non-resource one, and there IS a non-resource one
                props = {
                    ...props,
                    eventStore: protectedApi.mergeEventStores(sets[''].eventStore, props.eventStore),
                };
            }
            if (!protectedApi.isPropsValid(props, context, { resourceId }, filterConfig.bind(null, resourceId))) {
                return false;
            }
        }
        return true;
    }
    function filterConfig(resourceId, config) {
        return {
            ...config,
            constraints: filterConstraints(resourceId, config.constraints),
        };
    }
    function filterConstraints(resourceId, constraints) {
        return constraints.map((constraint) => {
            let defs = constraint.defs;
            if (defs) { // we are dealing with an EventStore
                // if any of the events define constraints to resources that are NOT this resource,
                // then this resource is unconditionally prohibited, which is what a `false` value does.
                for (let defId in defs) {
                    let resourceIds = defs[defId].resourceIds;
                    if (resourceIds.length && resourceIds.indexOf(resourceId) === -1) { // TODO: use a hash?!!! (for other reasons too)
                        return false;
                    }
                }
            }
            return constraint;
        });
    }

    function transformExternalDef(dateSpan) {
        return dateSpan.resourceId ?
            { resourceId: dateSpan.resourceId } :
            {};
    }

    const optionChangeHandlers = {
        resources: handleResources,
    };
    function handleResources(newSourceInput, context) {
        let oldSourceInput = context.getCurrentData().resourceSource._raw;
        if (oldSourceInput !== newSourceInput) {
            context.dispatch({
                type: 'RESET_RESOURCE_SOURCE',
                resourceSourceInput: newSourceInput,
            });
        }
    }

    const DEFAULT_RESOURCE_ORDER = protectedApi.parseFieldSpecs('id,title');
    function handleResourceStore(resourceStore, calendarData) {
        let { emitter } = calendarData;
        if (emitter.hasHandlers('resourcesSet')) {
            emitter.trigger('resourcesSet', buildResourceApis(resourceStore, calendarData));
        }
    }

    var resourcePlugin = {
        name: 'resource',
        premiumReleaseDate: '2026-11-12',
        deps: [premiumCommonPlugin],
        reducers: [reduceResources],
        isLoadingFuncs: [
            (state) => state.resourceSource && state.resourceSource.isFetching,
        ],
        eventRefiners: EVENT_REFINERS,
        eventDefMemberAdders: [generateEventDefResourceMembers],
        isDraggableTransformers: [transformIsDraggable],
        eventDragMutationMassagers: [massageEventDragMutation],
        eventDefMutationAppliers: [applyEventDefMutation],
        dateSelectionTransformers: [transformDateSelectionJoin],
        datePointTransforms: [transformDatePoint],
        dateSpanTransforms: [transformDateSpan],
        viewPropsTransformers: [ResourceDataAdder, ResourceEventConfigAdder],
        isPropsValid: isPropsValidWithResources,
        externalDefTransforms: [transformExternalDef],
        eventDropTransformers: [transformEventDrop],
        optionChangeHandlers,
        propSetHandlers: { resourceStore: handleResourceStore },
    };

    /*
    Utilities for filterResourcesWithEvents.

    View-wide (filterResourceStore, applied by each view for itself): a resource is shown when
    any of its events intersect the view's activeRange — ONE contiguous span.

    That coarseness is deliberate, not an oversight. The rule does not care whether an event
    lands on an invisible period INSIDE the span — an interior hidden day, or a gap outside
    slotMinTime/slotMaxTime — so such a resource is still shown, with a visibly empty column or
    row. Tightening this to "must fall on something actually rendered" was built and then
    reverted: every view family renders its span differently (timeline slots can be coarser than
    a day and paint the hidden days inside them; a whole-day timeline axis ignores slot times
    entirely), so a per-day rule silently deleted events that really did render. Treat the empty
    column as the accepted cost and leave the rule alone.

    Per-date (computeHasEventsByDate): the same intersection test asked once per rendered
    column, so multi-day vertical views can give a (date, resource) pair its own column. Being
    per-column makes it strictly finer than the view-wide pass, so a resource can survive
    view-wide and match no column at all; buildResourceTableModel falls back to day-only columns
    when that happens for every resource.

    KNOWN LIMITATION, predating this code and intentionally left alone: an event counts via its
    raw range even when it renders something else. Chiefly display:'inverse-background', which
    paints the COMPLEMENT of its range. Mirroring the inverse would mark every date the event
    does NOT cover, which effectively disables filtering for any resource carrying availability
    shading — worse than the current wart. A real fix excludes inverse-background and
    display:'none' outright, resolving display through compileEventUis (event/source/global
    levels), not def.ui alone.
    */
    function filterResourceStore(resourceStore, doFilterResourcesWithEvents, eventStore, activeRange) {
        if (!doFilterResourcesWithEvents) {
            return resourceStore;
        }
        let instancesInRange = filterEventInstancesInRange(eventStore.instances, activeRange);
        let hasEvents = computeHasEvents(instancesInRange, eventStore.defs);
        Object.assign(hasEvents, computeAncestorHasEvents(hasEvents, resourceStore));
        return protectedApi.filterHash(resourceStore, (resource, resourceId) => hasEvents[resourceId]);
    }
    function filterEventInstancesInRange(eventInstances, activeRange) {
        return protectedApi.filterHash(eventInstances, (eventInstance) => protectedApi.rangesIntersect(eventInstance.range, activeRange));
    }
    function computeHasEvents(eventInstances, eventDefs) {
        let hasEvents = {};
        for (let instanceId in eventInstances) {
            let instance = eventInstances[instanceId];
            for (let resourceId of eventDefs[instance.defId].resourceIds) {
                hasEvents[resourceId] = true;
            }
        }
        return hasEvents;
    }
    /*
    mark resources as having events if any of their ancestors have them
    NOTE: resourceStore might not have all the resources that hasEvents{} has keyed
    */
    function computeAncestorHasEvents(hasEvents, resourceStore) {
        let res = {};
        for (let resourceId in hasEvents) {
            let resource;
            while ((resource = resourceStore[resourceId])) {
                resourceId = resource.parentId; // now functioning as the parentId
                if (resourceId) {
                    res[resourceId] = true;
                }
                else {
                    break;
                }
            }
        }
        return res;
    }
    /*
    An event earns a column when it intersects that column's range — the same test as above,
    just asked per column instead of once.

    Two wrinkles, both about WHICH column an event renders in rather than about narrowing the
    window. All-day events render in the all-day row, on civil days, not inside a column's slot
    range; those coincide until slotMaxTime runs past midnight (or slotMinTime goes negative),
    at which point a column overlaps its neighbour's day and an all-day event there would earn a
    column that renders nothing. And daygrid slices timed events with nextDayThreshold, so
    matching must too.

    Column ranges are used as-is, NOT clipped to activeRange. A date disabled by validRange can
    therefore take a column for a resource that has events elsewhere in the view. Accepted: that
    column renders (disabled, empty) in an unfiltered view too, so filtering isn't inventing it.
    */
    function computeHasEventsByDate(eventStore, resourceStore, dayCols, nextDayThreshold = null) {
        let hasEventsByDate = dayCols.map(() => ({}));
        let civilDayRanges = dayCols.map((dayCol) => ({
            start: dayCol.date,
            end: protectedApi.addDays(dayCol.date, 1),
        }));
        for (let instanceId in eventStore.instances) {
            let instance = eventStore.instances[instanceId];
            let { allDay, resourceIds } = eventStore.defs[instance.defId];
            let range = (!allDay && nextDayThreshold)
                ? protectedApi.computeVisibleDayRange(instance.range, nextDayThreshold)
                : instance.range;
            for (let dateI = 0; dateI < dayCols.length; dateI += 1) {
                if (protectedApi.rangesIntersect(range, allDay ? civilDayRanges[dateI] : dayCols[dateI].range)) {
                    let hasEvents = hasEventsByDate[dateI];
                    for (let resourceId of resourceIds) {
                        hasEvents[resourceId] = true;
                    }
                }
            }
        }
        for (let hasEvents of hasEventsByDate) {
            Object.assign(hasEvents, computeAncestorHasEvents(hasEvents, resourceStore));
        }
        return hasEventsByDate;
    }

    /*
    TODO: move away from pooledHeight. simply create child-parent relationships w/ groups+resource
    The groups that are row-groups VS col-groups can be determined by colGroupDepth
    */
    function buildResourceHierarchy(resourceStore, orderSpecs, // why accepted when resourceNodeHash already ordered?
    groupSpecs = [], groupRowDepth = 0) {
        const resourceNodeHash = buildResourceNodeHash(resourceStore, orderSpecs);
        const resNodes = [];
        for (let resourceId in resourceNodeHash) {
            let resourceNode = resourceNodeHash[resourceId];
            if (!resourceNode.entity.parentId) {
                insertResourceNode(resourceNode, orderSpecs, groupSpecs, groupRowDepth, resNodes);
            }
        }
        return resNodes;
    }
    /*
    Builds a hash-by-id that contains ALL resources,
    but .children[] array is wired up as well
    */
    function buildResourceNodeHash(resourceStore, orderSpecs) {
        let nodeHash = {};
        for (let resourceId in resourceStore) {
            let resource = resourceStore[resourceId];
            nodeHash[resourceId] = {
                entity: resource,
                resourceFields: buildResourceFields(resource),
                children: [],
            };
        }
        for (let resourceId in resourceStore) {
            let resource = resourceStore[resourceId];
            if (resource.parentId) {
                let parentNode = nodeHash[resource.parentId];
                if (parentNode) {
                    insertResourceNodeInSiblings(nodeHash[resourceId], orderSpecs, parentNode.children);
                }
            }
        }
        return nodeHash;
    }
    function insertResourceNode(resourceNode, orderSpecs, groupSpecs, groupRowDepth, resNodes, groupIdPath = []) {
        if (groupSpecs.length) {
            const groupSpec = groupSpecs[0];
            const nextGroupIdPath = buildGroupIdPath(groupIdPath, groupSpec.field, resourceNode.resourceFields[groupSpec.field]);
            let groupNode = ensureGroupNodes(resourceNode, groupSpec, groupRowDepth <= 0, resNodes, nextGroupIdPath);
            insertResourceNode(resourceNode, orderSpecs, groupSpecs.slice(1), groupRowDepth - 1, groupNode.children, nextGroupIdPath);
        }
        else {
            insertResourceNodeInSiblings(resourceNode, orderSpecs, resNodes);
        }
    }
    function ensureGroupNodes(resourceNode, groupSpec, pooledHeight, resNodes, groupIdPath) {
        let groupValue = resourceNode.resourceFields[groupSpec.field];
        let groupNode;
        let newGroupIndex;
        // find an existing group that matches, or determine the position for a new group
        if (groupSpec.order) {
            for (newGroupIndex = 0; newGroupIndex < resNodes.length; newGroupIndex += 1) {
                let node = resNodes[newGroupIndex];
                let group = node.entity;
                let cmp = protectedApi.flexibleCompare(groupValue, group.value) * groupSpec.order;
                if (cmp === 0) {
                    groupNode = node;
                    break;
                }
                else if (cmp < 0) {
                    break;
                }
            }
        }
        else { // the groups are unordered
            for (newGroupIndex = 0; newGroupIndex < resNodes.length; newGroupIndex += 1) {
                let node = resNodes[newGroupIndex];
                let group = node.entity;
                if (group && groupValue === group.value) {
                    groupNode = node;
                    break;
                }
            }
        }
        if (!groupNode) {
            groupNode = {
                entity: {
                    id: buildGroupId(groupIdPath),
                    value: groupValue,
                    spec: groupSpec,
                },
                pooledHeight,
                children: [],
            };
            resNodes.splice(newGroupIndex, 0, groupNode);
        }
        return groupNode;
    }
    function insertResourceNodeInSiblings(resourceNode, orderSpecs, siblings) {
        let i;
        for (i = 0; i < siblings.length; i += 1) {
            let cmp = protectedApi.compareByFieldSpecs(// TODO: pass in ResourceApi?
            siblings[i].resourceFields, resourceNode.resourceFields, orderSpecs);
            if (cmp > 0) { // went 1 past. insert at i
                break;
            }
        }
        siblings.splice(i, 0, resourceNode);
    }
    function buildResourceFields(resource) {
        let obj = { ...resource.extendedProps, ...resource.ui, ...resource };
        delete obj.ui;
        delete obj.extendedProps;
        return obj;
    }
    // Hierarchy + Flattening
    // -------------------------------------------------------------------------------------------------
    function flattenResources(resourceStore, orderSpecs) {
        const hierarchy = buildResourceHierarchy(resourceStore, orderSpecs);
        const resResources = [];
        flattenResourceHierarchy(hierarchy, resResources);
        return resResources;
    }
    function flattenResourceHierarchy(resourceNodes, resResources) {
        for (const node of resourceNodes) {
            resResources.push(node.entity);
            flattenResourceHierarchy(node.children, resResources);
        }
    }
    // Utils
    // -------------------------------------------------------------------------------------------------
    function createEntityId(entity) {
        return isEntityGroup(entity) ? createGroupId(entity) : entity.id;
    }
    function createGroupId(group) {
        return group.id || buildGroupId(buildGroupIdPath([], group.spec.field, group.value));
    }
    function isEntityGroup(entity) {
        return Boolean(entity.spec);
    }
    function isGroupsEqual(group0, group1) {
        return createGroupId(group0) === createGroupId(group1);
    }
    function buildGroupIdPath(parentPath, field, value) {
        return parentPath.concat([[field, value]]);
    }
    function buildGroupId(path) {
        return JSON.stringify(path);
    }

    class ResourceIndex {
        constructor(resources) {
            let indicesById = {};
            let ids = [];
            for (let i = 0; i < resources.length; i += 1) {
                let id = resources[i].id;
                ids.push(id);
                indicesById[id] = i;
            }
            this.ids = ids;
            this.indicesById = indicesById;
            this.length = resources.length;
        }
    }

    /*
    TODO: move this so @fullcalendar/resource-daygrid
    */
    class AbstractResourceDayTableModel {
        constructor(dayCols, 
        // null for timegrid, which is a flat row of columns. daygrid passes one because its
        // columns can repeat across week rows, and only it needs the 2D `cells` projection.
        // residual seam: `cells` and `cols` describe the same columns at different dimensions
        dayTableModel, resources, groups, datesAboveResources, context) {
            this.dayCols = dayCols;
            this.dayTableModel = dayTableModel;
            this.resources = resources;
            this.groups = groups;
            this.datesAboveResources = datesAboveResources;
            let cols = [];
            let colLookup = {};
            let dateFirstCols = [];
            let colGroupIndices = [];
            let resourceColCount = 0;
            for (let groupI = 0; groupI < groups.length; groupI += 1) {
                for (let col of groups[groupI].cols) {
                    let colI = cols.length;
                    cols.push(col);
                    colLookup[buildColKey(col.dateI, col.resourceI)] = colI;
                    colGroupIndices.push(groupI);
                    if (col.resource) {
                        resourceColCount += 1;
                    }
                    if (dateFirstCols[col.dateI] == null) {
                        dateFirstCols[col.dateI] = colI;
                    }
                }
            }
            this.resourceIndex = new ResourceIndex(resources);
            this.colCount = cols.length;
            this.resourceColCount = resourceColCount;
            this.cols = cols;
            this.colLookup = colLookup;
            this.dateFirstCols = dateFirstCols;
            this.colGroupIndices = colGroupIndices;
            this.cells = !dayTableModel || dayTableModel.rowCount === 1
                ? [cols]
                : buildResourceCells(dayTableModel, cols, context);
        }
        /*
        -1 means the pair has no column, because per-date filtering dropped it. Callers must handle
        that — a seg aimed at a missing pair is discarded, which is how filtered layouts avoid
        rendering events into columns that don't exist.
        */
        computeCol(dateI, resourceI) {
            // the resourceless model keys every column under -1, so lookups succeed no matter which
            // resource index a splitter happens to pass in. placeholder columns for dates with no
            // resources are also keyed under -1, reachable by passing -1 explicitly
            let key = buildColKey(dateI, this.resources.length ? resourceI : -1);
            let col = this.colLookup[key];
            return col == null ? -1 : col;
        }
        computeColRanges(dateStartI, dateEndI, resourceI) {
            let ranges = [];
            let currentRange = null;
            let currentGroupI = -1;
            for (let dateI = dateStartI; dateI < dateEndI; dateI += 1) {
                let col = this.computeCol(dateI, resourceI);
                if (col !== -1) {
                    let groupI = this.colGroupIndices[col];
                    // adjacency alone isn't enough to merge: with dates above resources, one resource's
                    // columns for consecutive dates ARE adjacent but belong to different date groups, and
                    // a seg spanning them must break so each date renders its own segment
                    if (currentRange && currentRange.end === col && currentGroupI === groupI) {
                        currentRange.end = col + 1;
                        currentRange.isEnd = dateI === dateEndI - 1;
                    }
                    else {
                        currentRange = {
                            start: col,
                            end: col + 1,
                            isStart: dateI === dateStartI,
                            isEnd: dateI === dateEndI - 1,
                        };
                        currentGroupI = groupI;
                        ranges.push(currentRange);
                    }
                }
                else {
                    currentRange = null;
                    currentGroupI = -1;
                }
            }
            return ranges;
        }
        /*
        dates missing this resource's column (filtered-out) don't break the span.
        the highlight simply skips them while the reported range stays continuous, like a hidden day
        */
        isHitComboAllowed(hit0, hit1, allowAcrossResources) {
            return allowAcrossResources || hit0.dateSpan.resourceId === hit1.dateSpan.resourceId;
        }
    }
    function buildResourceCells(dayTableModel, cols, context) {
        let rows = [];
        for (let row = 0; row < dayTableModel.rowCount; row += 1) {
            rows.push(cols.map((col) => {
                let sourceCell = dayTableModel.cellRows[row][col.dateI];
                let { date, isDisabled } = sourceCell;
                let { resource } = col;
                if (!resource) {
                    return {
                        key: date.toISOString(),
                        date,
                        isMajor: col.isMajor,
                        isDisabled,
                        isInert: true,
                        attrs: { 'aria-disabled': true },
                    };
                }
                return {
                    ...buildResourceCellFields(resource, date, context),
                    date,
                    isMajor: col.isMajor,
                    isDisabled,
                };
            }));
        }
        return rows;
    }
    function buildResourceDayCol(dayCol, dateI, resource, resourceI, isMajor, context) {
        if (!resource) {
            return {
                ...dayCol,
                dateI,
                isInert: true,
                attrs: { 'aria-disabled': true },
                resource: null,
                resourceI,
                isMajor,
            };
        }
        return {
            ...dayCol,
            ...buildResourceCellFields(resource, dayCol.date, context),
            dateI,
            resource,
            resourceI,
            isMajor,
        };
    }
    /*
    What makes a day cell resource-specific. A fresh ResourceApi per cell is deliberate: in
    multi-row daygrid the same column is rebuilt for each week row.
    */
    function buildResourceCellFields(resource, date, context) {
        return {
            key: resource.id + ':' + date.toISOString(),
            renderProps: { resource: new ResourceApi(context, resource) },
            attrs: { 'data-resource-id': resource.id },
            className: '',
            dateSpanProps: { resourceId: resource.id },
        };
    }
    function buildColKey(dateI, resourceI) {
        return dateI + ':' + resourceI;
    }

    /*
    dates over resources
    */
    function buildDayResourceTableModel(dayTableModel, dayCols, resources, context, hasEventsByDate = null) {
        // Day boundaries remain major even when filtering leaves only one resource.
        let hasMajor = dayCols.length > 1;
        let groups = [];
        for (let dateI = 0; dateI < dayCols.length; dateI += 1) {
            let dayCol = dayCols[dateI];
            let cols = [];
            for (let resourceI = 0; resourceI < resources.length; resourceI += 1) {
                let resource = resources[resourceI];
                if (!hasEventsByDate || hasEventsByDate[dateI][resource.id]) {
                    cols.push(buildResourceDayCol(dayCol, dateI, resource, resourceI, hasMajor && cols.length === 0, context));
                }
            }
            if (!cols.length) {
                cols.push(buildResourceDayCol(dayCol, dateI, null, -1, hasMajor, context));
            }
            groups.push({ date: dayCol.date, cols });
        }
        return new AbstractResourceDayTableModel(dayCols, dayTableModel, resources, groups, true, context);
    }

    /*
    resources over dates
    */
    function buildResourceDayTableModel(dayTableModel, dayCols, resources, context, hasEventsByDate = null) {
        let hasMajor = resources.length > 1 && dayCols.length > 1;
        let groups = [];
        for (let resourceI = 0; resourceI < resources.length; resourceI += 1) {
            let resource = resources[resourceI];
            let cols = [];
            for (let dateI = 0; dateI < dayCols.length; dateI += 1) {
                if (!hasEventsByDate || hasEventsByDate[dateI][resource.id]) {
                    cols.push(buildResourceDayCol(dayCols[dateI], dateI, resource, resourceI, hasMajor && cols.length === 0, context));
                }
            }
            // a resource with no surviving date drops out of the header AND the body entirely.
            // intentional: a filtered view never shows a resource heading spanning zero columns
            if (cols.length) {
                groups.push({ resource, cols });
            }
        }
        return new AbstractResourceDayTableModel(dayCols, dayTableModel, resources, groups, false, context);
    }

    /*
    TODO: move this so @fullcalendar/resource-daygrid
    */
    function buildResourcelessDayTableModel(dayTableModel, dayCols, context) {
        let cols = dayCols.map((dayCol, dateI) => (buildResourceDayCol(dayCol, dateI, null, -1, dayCol.isMajor, context)));
        return new AbstractResourceDayTableModel(dayCols, dayTableModel, [], [{ cols }], false, context);
    }

    /*
    TODO: kill this and DayResourceTableModel/ResourceDayTableModel/ResourcelessDayTableModel,
    which differ only in column ordering and presence
    */
    function buildResourceTableModel(dayTableModel, // only for multi-row daygrid
    dayCols, resources, datesAboveResources, hasEventsByDate, context) {
        if (!resources.length) {
            return buildResourcelessDayTableModel(dayTableModel, dayCols, context);
        }
        let model = datesAboveResources ?
            buildDayResourceTableModel(dayTableModel, dayCols, resources, context, hasEventsByDate) :
            buildResourceDayTableModel(dayTableModel, dayCols, resources, context, hasEventsByDate);
        // per-date filtering asks a per-column question, so it's strictly finer than the view-wide
        // pass that produced `resources`. a resource can clear that and still match no column — its
        // only events fall on a hidden day, or outside every column's rendered range. if that's true
        // of every resource, every column is a placeholder (or there are none), so render plain day
        // columns instead
        if (hasEventsByDate && !model.resourceColCount) {
            return buildResourcelessDayTableModel(dayTableModel, dayCols, context);
        }
        return model;
    }

    /*
    TODO: just use ResourceHash somehow? could then use the generic ResourceSplitter
    */
    class VResourceSplitter extends protectedApi.Splitter {
        getKeyInfo(props) {
            let { resourceDayTableModel } = props;
            let hash = protectedApi.mapHash(resourceDayTableModel.resourceIndex.indicesById, (i) => resourceDayTableModel.resources[i]); // :(
            hash[''] = {};
            return hash;
        }
        getKeysForDateSpan(dateSpan) {
            return [dateSpan.resourceId || ''];
        }
        getKeysForEventDef(eventDef) {
            let resourceIds = eventDef.resourceIds;
            if (!resourceIds.length) {
                return [''];
            }
            return resourceIds;
        }
    }

    const NO_SEGS = []; // for memoizing
    class VResourceJoiner {
        constructor() {
            this.joinDateSelection = protectedApi.memoize(this.joinSegs);
            this.joinBusinessHours = protectedApi.memoize(this.joinBusinessHourSegs);
            this.joinFgEvents = protectedApi.memoize(this.joinSegs);
            this.joinBgEvents = protectedApi.memoize(this.joinSegs);
            this.joinEventDrags = protectedApi.memoize(this.joinInteractions);
            this.joinEventResizes = protectedApi.memoize(this.joinInteractions);
        }
        /*
        propSets also has a '' key for things with no resource
        */
        joinProps(propSets, resourceDayTable) {
            let dateSelectionSets = [];
            let businessHoursSets = [];
            let fgEventSets = [];
            let bgEventSets = [];
            let eventDrags = [];
            let eventResizes = [];
            let eventSelection = '';
            let keys = resourceDayTable.resourceIndex.ids.concat(['']); // add in the all-resource key
            for (let key of keys) {
                let props = propSets[key];
                dateSelectionSets.push(props.dateSelectionSegs);
                businessHoursSets.push(props.businessHourSegs);
                fgEventSets.push(key ? props.fgEventSegs : NO_SEGS); // don't include fg all-resource segs
                bgEventSets.push(props.bgEventSegs);
                eventDrags.push(props.eventDrag);
                eventResizes.push(props.eventResize);
                eventSelection = eventSelection || props.eventSelection;
            }
            return {
                dateSelectionSegs: this.joinDateSelection(resourceDayTable, ...dateSelectionSets),
                businessHourSegs: this.joinBusinessHours(resourceDayTable, ...businessHoursSets),
                fgEventSegs: this.joinFgEvents(resourceDayTable, ...fgEventSets),
                bgEventSegs: this.joinBgEvents(resourceDayTable, ...bgEventSets),
                eventDrag: this.joinEventDrags(resourceDayTable, ...eventDrags),
                eventResize: this.joinEventResizes(resourceDayTable, ...eventResizes),
                eventSelection,
            };
        }
        /*
        Placeholder columns (resourceI -1) belong to no resource, so they take only the
        all-resource segs, like a resource timeline's non-resource background spanning every row
        */
        joinSegs(resourceDayTable, ...segGroups) {
            let resourceCnt = resourceDayTable.resources.length;
            let transformedSegs = [];
            for (let i = 0; i < resourceCnt; i += 1) {
                for (let seg of segGroups[i]) {
                    transformedSegs.push(...this.transformSeg(seg, resourceDayTable, i));
                }
                for (let seg of segGroups[resourceCnt]) { // one beyond. the all-resource
                    transformedSegs.push(...this.transformSeg(seg, resourceDayTable, i));
                }
            }
            for (let seg of segGroups[resourceCnt]) {
                transformedSegs.push(...this.transformSeg(seg, resourceDayTable, -1));
            }
            return transformedSegs;
        }
        /*
        Like joinSegs, but the splitter already gives every resource its own business hours (falling
        back to the calendar's), so the all-resource business hours go to placeholder columns only
        */
        joinBusinessHourSegs(resourceDayTable, ...segGroups) {
            let resourceCnt = resourceDayTable.resources.length;
            let transformedSegs = [];
            for (let i = 0; i < resourceCnt; i += 1) {
                for (let seg of segGroups[i]) {
                    transformedSegs.push(...this.transformSeg(seg, resourceDayTable, i));
                }
            }
            for (let seg of segGroups[resourceCnt]) {
                transformedSegs.push(...this.transformSeg(seg, resourceDayTable, -1));
            }
            return transformedSegs;
        }
        /*
        for expanding non-resource segs to all resources, and to placeholder columns.
        only for public use.
        no memoizing.
        */
        expandSegs(resourceDayTable, segs) {
            return this.joinSegs(resourceDayTable, ...resourceDayTable.resources.map(() => NO_SEGS), segs);
        }
        joinInteractions(resourceDayTable, ...interactions) {
            let resourceCnt = resourceDayTable.resources.length;
            let affectedInstances = {};
            let transformedSegs = [];
            let anyInteractions = false;
            let isEvent = false;
            for (let i = 0; i < resourceCnt; i += 1) {
                let interaction = interactions[i];
                if (interaction) {
                    anyInteractions = true;
                    for (let seg of interaction.segs) {
                        transformedSegs.push(...this.transformSeg(seg, resourceDayTable, i));
                    }
                    Object.assign(affectedInstances, interaction.affectedInstances);
                    isEvent = isEvent || interaction.isEvent;
                }
                if (interactions[resourceCnt]) { // one beyond. the all-resource
                    for (let seg of interactions[resourceCnt].segs) {
                        transformedSegs.push(...this.transformSeg(seg, resourceDayTable, i));
                    }
                }
            }
            // note `anyInteractions` tracks REAL-resource interactions only. an interaction with no
            // resource at all produces segs above but doesn't activate rendering — matches
            // pre-existing behavior, so don't "fix" it by folding the all-resource branch in
            if (anyInteractions) {
                return {
                    affectedInstances,
                    segs: transformedSegs,
                    isEvent,
                };
            }
            return null;
        }
    }

    class ResourceDayTableJoiner extends VResourceJoiner {
        transformSeg(seg, resourceDayTableModel, resourceI) {
            let dateStartI = seg.start;
            let dateEndI = seg.end;
            let colRanges = resourceDayTableModel.computeColRanges(dateStartI, dateEndI, resourceI);
            return colRanges.map((colRange) => ({
                ...seg,
                ...colRange,
                isStart: seg.isStart && colRange.isStart,
                isEnd: seg.isEnd && colRange.isEnd,
            }));
        }
    }

    function buildResourceRowConfigs(resourceDayTableModel, datesRepDistinctDays, dateProfile, todayRange, dayHeaderFormat, // TODO: rename to dateHeaderFormat?
    context, blankClassNameGenerator, blankRenderProps) {
        let { cols, groups, resources } = resourceDayTableModel;
        if (!resources.length) {
            return [
                protectedApi.buildDateRowConfig(cols.map((col) => col.date), datesRepDistinctDays, dateProfile, todayRange, dayHeaderFormat, context)
            ];
        }
        if (resourceDayTableModel.dayCols.length === 1) {
            return [
                buildResourceRowConfig(cols.map((col) => col.resource), cols[0]?.date, dateProfile, todayRange, context)
            ];
        }
        if (resourceDayTableModel.datesAboveResources) {
            const resourceDataConfigsPerDate = groups.map((group) => {
                const col = group.cols[0];
                if (!col.resource) {
                    return [{
                            key: col.key + ':blank',
                            dateMarker: col.date,
                            blank: {
                                classNameGenerator: blankClassNameGenerator,
                            },
                            renderProps: {
                                ...protectedApi.getDateMeta(col.date, context.dateEnv, dateProfile, todayRange),
                                isMajor: col.isMajor,
                                isNarrow: false, // overridden by the header cell
                                view: context.viewApi,
                                ...blankRenderProps,
                            },
                            attrs: {
                                'data-date': protectedApi.formatDayString(col.date),
                            },
                            colSpan: 1,
                        }];
                }
                return buildResourceDataConfigs(group.cols.map((col) => col.resource), group.date, dateProfile, todayRange, context, 
                /* colSpan = */ 1, 
                /* isMajorMod = */ group.cols.length);
            });
            const dateRowConfig = protectedApi.buildDateRowConfig(groups.map((group) => group.date), datesRepDistinctDays, dateProfile, todayRange, dayHeaderFormat, context, 
            /* colSpan = */ 1, 
            /* isMajorMod = */ 1, // each cell is major, mod%1 always yields 0 (yes)
            // Keep navigation based on the full date range.
            /* totalDateCnt = */ resourceDayTableModel.dayCols.length);
            for (let i = 0; i < groups.length; i += 1) {
                dateRowConfig.dataConfigs[i].colSpan = groups[i].cols.length;
            }
            return [
                // date row
                dateRowConfig,
                // resource row
                {
                    isDateRow: false,
                    renderConfig: buildResourceRenderConfig(context),
                    dataConfigs: [].concat(...resourceDataConfigsPerDate), // flatten
                }
            ];
        }
        else { // resources above dates
            const dateDataConfigsPerResource = groups.map((group) => {
                const resource = group.resource;
                const resourceApi = new ResourceApi(context, resource);
                const resourceApiId = resourceApi.id;
                return protectedApi.buildDateDataConfigs(group.cols.map((col) => col.date), datesRepDistinctDays, dateProfile, todayRange, dayHeaderFormat, context, 1, // rowSpan
                resourceApiId + ':', {
                    resource: resourceApi,
                }, {
                    'data-resource-id': resourceApiId,
                }, 
                /* className = */ undefined, // TODO: remove
                /* isMajorMod = */ group.cols.length, 
                /* totalDateCnt = */ resourceDayTableModel.dayCols.length);
            });
            const resourceDataConfigs = groups.map((group) => {
                return buildResourceDataConfigs([group.resource], group.date, dateProfile, todayRange, context, 
                /* colSpan = */ group.cols.length, 
                /* isMajorMod = */ 1)[0];
            });
            return [
                // resource row
                {
                    isDateRow: false,
                    renderConfig: buildResourceRenderConfig(context),
                    dataConfigs: resourceDataConfigs,
                },
                // date row
                {
                    isDateRow: true,
                    renderConfig: protectedApi.buildDateRenderConfig(dayHeaderFormat, datesRepDistinctDays, context),
                    dataConfigs: [].concat(...dateDataConfigsPerResource), // flatten
                }
            ];
        }
    }
    /*
    Single row, just resources (might be under dates, might not)
    */
    function buildResourceRowConfig(resources, dateMarker, dateProfile, todayRange, context, colSpan, isMajorMod) {
        return {
            isDateRow: false,
            renderConfig: buildResourceRenderConfig(context),
            dataConfigs: buildResourceDataConfigs(resources, dateMarker, dateProfile, todayRange, context, colSpan, isMajorMod),
        };
    }
    function buildResourceRenderConfig(context) {
        const { options } = context;
        return {
            generatorName: 'resourceDayHeaderContent',
            customGenerator: options.resourceDayHeaderContent,
            innerClassNameGenerator: options.resourceDayHeaderInnerClass,
            classNameGenerator: options.resourceDayHeaderClass,
            didMount: options.resourceDayHeaderDidMount,
            willUnmount: options.resourceDayHeaderWillUnmount,
            align: options.resourceDayHeaderAlign,
            sticky: options._resourceDayHeaderSticky,
        };
    }
    function buildResourceDataConfigs(resources, dateMarker, dateProfile, todayRange, context, colSpan = 1, isMajorMod) {
        const dateMeta = dateMarker
            ? protectedApi.getDateMeta(dateMarker, context.dateEnv, dateProfile, todayRange)
            : {};
        return resources.map((resource, i) => {
            const resourceApi = new ResourceApi(context, resource);
            const resourceApiId = resourceApi.id;
            return {
                key: (dateMarker ? dateMarker.toUTCString() + ':' : '') + resource.id,
                dateMarker,
                renderProps: {
                    isDisabled: false,
                    ...dateMeta,
                    resource: resourceApi,
                    isMajor: isMajorMod != null && !(i % isMajorMod),
                    isNarrow: false, // HACK. gets overridden later
                    level: 0, // HACK. gets overridden later
                    text: resource.title || resourceApiId || '',
                    view: context.viewApi,
                },
                attrs: {
                    'data-resource-id': resourceApiId,
                    'data-date': dateMarker ? protectedApi.formatDayString(dateMarker) : undefined,
                },
                colSpan,
                className: '', // TODO: remove this prop
            };
        });
    }

    class ResourceDayGridView extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            // memo
            this.filterResourceStore = protectedApi.memoize(filterResourceStore);
            this.flattenResources = protectedApi.memoize(flattenResources);
            this.buildDayTableModel = protectedApi.memoize(protectedApi.buildDayTableModel);
            this.buildDayCols = protectedApi.memoize(buildDayGridCols);
            this.computeHasEventsByDate = protectedApi.memoize(computeHasEventsByDate);
            this.buildResourceTableModel = protectedApi.memoize(buildResourceTableModel);
            this.createDayHeaderFormatter = protectedApi.memoize(protectedApi.createDayHeaderFormatter);
            this.buildResourceRowConfigs = protectedApi.memoize(buildResourceRowConfigs);
            this.buildBlankRenderProps = protectedApi.memoize(buildBlankDayCellProps);
            this.splitter = new VResourceSplitter();
            this.slicers = {};
            this.joiner = new ResourceDayTableJoiner();
            this.isHitComboAllowed = (hit0, hit1) => {
                let allowAcrossResources = this.dayTableModel.colCount === 1;
                return this.resourceDayTableModel.isHitComboAllowed(hit0, hit1, allowAcrossResources);
            };
        }
        render() {
            let { props, context } = this;
            let { options } = context;
            let resourceStore = this.filterResourceStore(props.resourceStore, options.filterResourcesWithEvents, props.rawEventStore, props.dateProfile.activeRange);
            let resourceOrderSpecs = options.resourceOrder || DEFAULT_RESOURCE_ORDER;
            let resources = this.flattenResources(resourceStore, resourceOrderSpecs);
            let dayTable = this.dayTableModel = this.buildDayTableModel(props.dateProfile, context.dateProfileGenerator, context.dateEnv);
            let dayCols = this.buildDayCols(dayTable);
            // a multi-row column represents one weekday across many dates, so it has no single date
            // to filter by — those views keep view-wide filtering only. nextDayThreshold matches how
            // the renderer decides which day a timed event's tail belongs to
            let hasEventsByDate = options.filterResourcesWithEvents && dayTable.colCount > 1 && dayTable.rowCount === 1
                ? this.computeHasEventsByDate(props.rawEventStore, resourceStore, dayCols, options.nextDayThreshold)
                : null;
            let resourceDayTableModel = this.resourceDayTableModel = this.buildResourceTableModel(dayTable, dayCols, resources, options.datesAboveResources, hasEventsByDate, context);
            let splitProps = this.splitter.splitProps({
                resourceDayTableModel,
                businessHours: props.businessHours,
                dateSelection: props.dateSelection,
                eventStore: props.eventStore,
                eventUiBases: props.eventUiBases,
                eventSelection: props.eventSelection,
                eventDrag: props.eventDrag,
                eventResize: props.eventResize,
            });
            this.slicers = protectedApi.mapHash(splitProps, (split, resourceId) => this.slicers[resourceId] || new protectedApi.DayTableSlicer());
            let slicedProps = protectedApi.mapHash(this.slicers, (slicer, resourceId) => slicer.sliceProps(splitProps[resourceId], props.dateProfile, options.nextDayThreshold, context, dayTable));
            let joinedSlicedProps = this.joiner.joinProps(slicedProps, resourceDayTableModel);
            let datesRepDistinctDays = dayTable.rowCount === 1;
            let dayHeaderFormat = this.createDayHeaderFormatter(context.options.dayHeaderFormat, datesRepDistinctDays, resourceDayTableModel.colCount);
            return (jsxRuntime.jsx(protectedApi.NowTimer, { unit: "day", children: (nowDate, todayRange) => {
                    const headerTiers = this.buildResourceRowConfigs(resourceDayTableModel, datesRepDistinctDays, props.dateProfile, todayRange, dayHeaderFormat, context, options.dayCellClass, this.buildBlankRenderProps(Boolean(options.businessHours)));
                    return (jsxRuntime.jsx(protectedApi.DayGridLayout, { labelId: props.labelId, labelStr: props.labelStr, dateProfile: props.dateProfile, todayRange: todayRange, cellRows: resourceDayTableModel.cells, forPrint: props.forPrint, isHitComboAllowed: this.isHitComboAllowed, className: props.className, 
                        // header content
                        headerTiers: headerTiers, 
                        // body content
                        fgEventSegs: joinedSlicedProps.fgEventSegs, bgEventSegs: joinedSlicedProps.bgEventSegs, businessHourSegs: joinedSlicedProps.businessHourSegs, dateSelectionSegs: joinedSlicedProps.dateSelectionSegs, eventDrag: joinedSlicedProps.eventDrag, eventResize: joinedSlicedProps.eventResize, eventSelection: joinedSlicedProps.eventSelection }));
                } }));
        }
    }
    // Extra DayCellInfo props for the blank header's dayCellClass hook.
    // buildResourceRowConfigs supplies the shared date props.
    function buildBlankDayCellProps(businessHours) {
        return {
            inPopover: false,
            hasNavLink: false,
            text: '',
            textParts: [],
            weekdayText: '',
            dayNumberText: '',
            monthText: '',
            options: { businessHours },
        };
    }
    // Resource daygrid columns repeat across rows, so their date-level descriptors use the first row.
    function buildDayGridCols(dayTable) {
        return dayTable.cellRows[0].map((cell) => ({
            ...cell,
            range: {
                start: cell.date,
                end: protectedApi.addDays(cell.date, 1),
            },
        }));
    }

    var resourceDayGridPlugin = {
        name: 'resource-daygrid',
        premiumReleaseDate: '2026-11-12',
        deps: [
            premiumCommonPlugin,
            resourcePlugin,
            dayGridPlugin__default["default"],
        ],
        initialView: 'resourceDayGridDay',
        views: {
            resourceDayGrid: {
                type: 'dayGrid', // will inherit this configuration
                component: ResourceDayGridView,
                needsResourceData: true,
            },
            resourceDayGridDay: {
                type: 'resourceDayGrid',
                duration: { days: 1 },
            },
            resourceDayGridWeek: {
                type: 'resourceDayGrid',
                duration: { weeks: 1 },
            },
            resourceDayGridMonth: {
                type: 'resourceDayGrid',
                duration: { months: 1 },
                fixedWeekCount: true,
            },
        },
    };

    function joinDateTimeFormatParts(parts) {
        let s = '';
        for (const part of parts) {
            s += part.value;
        }
        return s;
    }

    /*
    TODO: detangle and use from @full-ui/headless-grid
    */
    class ScrollerSyncer {
        constructor(isHorizontal = false) {
            this.isHorizontal = isHorizontal;
            this.emitter = new protectedApi.Emitter();
            this.scrollers = [];
            this.destroyFuncs = [];
            this.isPaused = false;
        }
        handleChildren(scrollers) {
            if (!protectedApi.isArraysEqual(this.scrollers, scrollers)) {
                this.destroy();
                for (const scroller of scrollers) {
                    if (scroller) { // could be null
                        this.destroyFuncs.push(this.bindScroller(scroller));
                        this.scrollers.push(scroller);
                    }
                }
            }
        }
        destroy() {
            for (let destroyFunc of this.destroyFuncs) {
                destroyFunc();
            }
            this.destroyFuncs = [];
            this.scrollers = [];
        }
        get x() {
            const { scrollers, masterScroller } = this;
            return (masterScroller || scrollers[0]).x;
        }
        get y() {
            const { scrollers, masterScroller } = this;
            return (masterScroller || scrollers[0]).y;
        }
        scrollTo(scrollArg) {
            this.isPaused = true; // Not sure how this works, given that scroll handlers fire asynchronously
            const { scrollers } = this;
            for (let scroller of scrollers) {
                scroller.scrollTo(scrollArg);
            }
            this.isPaused = false;
        }
        addScrollListener(handler) {
            this.emitter.on('scroll', handler);
        }
        removeScrollListener(handler) {
            this.emitter.off('scroll', handler);
        }
        addScrollStartListener(handler) {
            this.emitter.on('scrollStart', handler);
        }
        removeScrollStartListener(handler) {
            this.emitter.off('scrollStart', handler);
        }
        addScrollEndListener(handler) {
            this.emitter.on('scrollEnd', handler);
        }
        removeScrollEndListener(handler) {
            this.emitter.off('scrollEnd', handler);
        }
        bindScroller(scroller) {
            let { isHorizontal } = this;
            const onScroll = (isDevice) => {
                if (!this.isPaused) {
                    if (!this.masterScroller) {
                        this.emitter.trigger('scrollStart', isDevice);
                    }
                    if (!this.masterScroller || (this.masterScroller !== scroller && isDevice)) {
                        this.assignMaster(scroller);
                    }
                    if (this.masterScroller === scroller) { // dealing with current
                        for (let otherScroller of this.scrollers) {
                            if (otherScroller !== scroller) {
                                if (isHorizontal) {
                                    // TODO: user raw scrollLeft for better performance. No normalization necessary
                                    otherScroller.scrollTo({ x: scroller.x });
                                }
                                else {
                                    otherScroller.scrollTo({ y: scroller.y });
                                }
                            }
                        }
                        this.emitter.trigger('scroll', isDevice, isHorizontal ? scroller.x : scroller.y);
                    }
                }
            };
            const onScrollEnd = (isDevice) => {
                if (this.masterScroller === scroller) {
                    this.masterScroller = null;
                    // Always pair with scrollStart, even if the scroll ended where it started, such as when
                    // the browser clamps it after content shrinks. Listeners track scrolling state
                    this.emitter.trigger('scrollEnd', isDevice);
                }
            };
            scroller.listener.emitter.on('scroll', onScroll);
            scroller.listener.emitter.on('scrollEnd', onScrollEnd);
            return () => {
                scroller.listener.emitter.off('scroll', onScroll);
                scroller.listener.emitter.off('scrollEnd', onScrollEnd);
            };
        }
        assignMaster(masterScroller) {
            this.masterScroller = masterScroller;
            for (let scroller of this.scrollers) {
                if (scroller !== masterScroller) {
                    scroller.endScroll(); // to prevent residual scrolls from reclaiming master
                }
            }
        }
    }

    function buildTimelineTimeAxis(args) {
        const { dateEnv, isDateVisible } = args;
        const slots = [];
        const snapStepMs = protectedApi.asRoughMs(args.snapDuration);
        const { normalizedRange } = args;
        const maxWindowMs = Math.min(args.timeWindowMs, 86400000);
        for (let windowStart = normalizedRange.start; windowStart < normalizedRange.end; windowStart = protectedApi.addDays(windowStart, 1)) {
            const windowEnd = new Date(Math.min(windowStart.valueOf() + maxWindowMs, normalizedRange.end.valueOf()));
            const windowStartMs = dateEnv.toDate(windowStart).valueOf();
            const windowEndMs = dateEnv.toDate(windowEnd).valueOf();
            if (windowStartMs >= windowEndMs) {
                continue;
            }
            const boundaries = [];
            const windowStartOffsetMs = dateEnv.timestampToMarker(windowStartMs).valueOf() - windowStartMs;
            const windowEndOffsetMs = dateEnv.timestampToMarker(windowEndMs).valueOf() - windowEndMs;
            const resolveOccurrences = windowStartOffsetMs === windowEndOffsetMs
                ? (marker) => [marker.valueOf() - windowStartOffsetMs]
                : (marker) => resolveMarkerOccurrences(marker, dateEnv);
            for (let date = windowStart; date < windowEnd; date = dateEnv.add(date, args.slotDuration)) {
                for (const startMs of resolveOccurrences(date)) {
                    if (startMs >= windowStartMs && startMs < windowEndMs) {
                        boundaries.push({ date, startMs });
                    }
                }
            }
            boundaries.sort((a, b) => a.startMs - b.startMs);
            // A nonexistent civil window start has no grid occurrence. Preserve the real interval
            // before the first surviving grid boundary instead of silently clipping it from the axis.
            if (!boundaries.length || boundaries[0].startMs > windowStartMs) {
                boundaries.unshift({
                    date: dateEnv.timestampToMarker(windowStartMs),
                    startMs: windowStartMs,
                });
            }
            boundaries.push({ date: windowEnd, startMs: windowEndMs });
            for (let i = 0; i < boundaries.length - 1; i += 1) {
                const boundary = boundaries[i];
                const endMs = boundaries[i + 1].startMs;
                if (boundary.startMs < endMs && isDateVisible(boundary.date)) {
                    slots.push({
                        date: boundary.date,
                        key: buildTimelineAxisKey(boundary.date, boundary.startMs),
                        startMs: boundary.startMs,
                        endMs,
                    });
                }
            }
        }
        return {
            slots,
            snapStepMs,
        };
    }
    /*
    Returns every real occurrence of a civil marker in a window whose endpoint offsets differ.
    Offset guesses sampled on both sides of the marker find both sides of a fold; round-tripping
    rejects guesses inside a spring-forward gap. Constant-offset windows use direct arithmetic
    in buildTimelineTimeAxis and avoid these projections for every grid marker.
    */
    function resolveMarkerOccurrences(marker, dateEnv) {
        const resolvedMs = dateEnv.toDate(marker).valueOf();
        const occurrences = new Set();
        for (const dayOffset of [-2, -1, 0, 1, 2]) {
            const sampleMs = resolvedMs + dayOffset * 86400000;
            const offsetMs = dateEnv.timestampToMarker(sampleMs).valueOf() - sampleMs;
            const candidateMs = marker.valueOf() - offsetMs;
            if (dateEnv.timestampToMarker(candidateMs).valueOf() === marker.valueOf()) {
                occurrences.add(candidateMs);
            }
        }
        return Array.from(occurrences).sort((a, b) => a - b);
    }
    /*
    The offset must be derived from the marker/instant pair. Asking DateEnv for a marker's offset
    would resolve ambiguous fall-back civil times to their first occurrence, giving both
    occurrences identical keys.
    */
    function buildTimelineAxisKey(marker, instantMs) {
        const offsetMinutes = Math.round((marker.valueOf() - instantMs) / 60000);
        return `${marker.toISOString()}:${offsetMinutes}`;
    }
    /*
    Re-derives a slot's civil-marker-based DateMeta from its exact instant. startMs is present
    only on timed axes (null for whole-day axes, which keep the civil meta untouched). Needed
    because the civil marker alone is ambiguous during a DST fall-back: both 01:00 slots share
    a marker, so the render-prop date and past/future must come from real instants. Used by
    header cells and slot lanes — keep them consistent.
    */
    function applyExactSlotMeta(dateMeta, startMs, nowMs) {
        if (startMs == null) {
            return dateMeta;
        }
        return {
            ...dateMeta,
            date: new Date(startMs),
            isPast: !dateMeta.isDisabled && startMs < nowMs,
            isFuture: !dateMeta.isDisabled && startMs > nowMs,
        };
    }
    function getTimelineAxisStartMs(timeAxis) {
        return timeAxis.slots.length ? timeAxis.slots[0].startMs : null;
    }
    function getTimelineAxisEndMs(timeAxis) {
        return timeAxis.slots.length ? timeAxis.slots[timeAxis.slots.length - 1].endMs : null;
    }

    const MIN_AUTO_LABELS = 18; // more than `12` months but less that `24` hours
    const MAX_AUTO_SLOTS_PER_LABEL = 6; // allows 6 10-min slots in an hour
    const MAX_AUTO_CELLS = 200; // allows 4-days to have a :30 slot duration
    protectedApi.config.MAX_TIMELINE_SLOTS = 1000;
    // potential nice values for slot-duration and interval-duration
    const STOCK_SUB_DURATIONS = [
        { years: 1 },
        { months: 1 },
        { days: 1 },
        { hours: 1 },
        { minutes: 30 },
        { minutes: 15 },
        { minutes: 10 },
        { minutes: 5 },
        { minutes: 1 },
        { seconds: 30 },
        { seconds: 15 },
        { seconds: 10 },
        { seconds: 5 },
        { seconds: 1 },
        { milliseconds: 500 },
        { milliseconds: 100 },
        { milliseconds: 10 },
        { milliseconds: 1 },
    ];
    function buildTimelineDateProfile(dateProfile, dateEnv, allOptions, dateProfileGenerator) {
        let tDateProfile = {
            labelInterval: allOptions.slotHeaderInterval,
            slotDuration: allOptions.slotDuration,
        };
        validateLabelAndSlot(tDateProfile, dateProfile, dateEnv); // validate after computed grid duration
        ensureLabelInterval(tDateProfile, dateProfile, dateEnv);
        ensureSlotDuration(tDateProfile, dateProfile, dateEnv);
        let input = allOptions.slotHeaderFormat;
        let rawFormats;
        let headerFormatUnits;
        if (Array.isArray(input)) {
            rawFormats = input;
            headerFormatUnits = input.map(inferHeaderFormatUnit);
        }
        else if (input != null) {
            rawFormats = [input];
            headerFormatUnits = [inferHeaderFormatUnit(input)];
        }
        else {
            const computed = computeHeaderFormats(tDateProfile, dateProfile, dateEnv, allOptions);
            rawFormats = computed.formats;
            headerFormatUnits = computed.units;
        }
        tDateProfile.headerFormats = rawFormats.map((rawFormat) => protectedApi.createFormatter(rawFormat));
        tDateProfile.headerFormatUnits = headerFormatUnits;
        tDateProfile.isTimeScale = Boolean(tDateProfile.slotDuration.milliseconds);
        let largeUnit = null;
        if (!tDateProfile.isTimeScale) {
            const slotUnit = protectedApi.greatestDurationDenominator(tDateProfile.slotDuration).unit;
            if (/year|month|week/.test(slotUnit)) {
                largeUnit = slotUnit;
            }
        }
        tDateProfile.largeUnit = largeUnit;
        /*
        console.log('label interval =', timelineView.labelInterval.humanize())
        console.log('slot duration =', timelineView.slotDuration.humanize())
        console.log('header formats =', timelineView.headerFormats)
        console.log('isTimeScale', timelineView.isTimeScale)
        console.log('largeUnit', timelineView.largeUnit)
        */
        let rawSnapDuration = allOptions.snapDuration;
        let snapDuration;
        let snapsPerSlot;
        if (rawSnapDuration) {
            snapDuration = protectedApi.createDuration(rawSnapDuration);
            snapsPerSlot = protectedApi.wholeDivideDurations(tDateProfile.slotDuration, snapDuration);
            // ^ TODO: warning if not whole?
        }
        if (snapsPerSlot == null) {
            snapDuration = tDateProfile.slotDuration;
            snapsPerSlot = 1;
        }
        tDateProfile.snapDuration = snapDuration;
        tDateProfile.snapsPerSlot = snapsPerSlot;
        // more...
        let timeWindowMs = protectedApi.asRoughMs(dateProfile.slotMaxTime) - protectedApi.asRoughMs(dateProfile.slotMinTime);
        // TODO: why not use normalizeRange!?
        let normalizedStart = normalizeDate(dateProfile.renderRange.start, tDateProfile, dateEnv);
        let normalizedEnd = normalizeDate(dateProfile.renderRange.end, tDateProfile, dateEnv);
        // apply slotMinTime/slotMaxTime
        // TODO: View should be responsible.
        if (tDateProfile.isTimeScale) {
            normalizedStart = dateEnv.add(normalizedStart, dateProfile.slotMinTime);
            normalizedEnd = dateEnv.add(protectedApi.addDays(normalizedEnd, -1), dateProfile.slotMaxTime);
        }
        tDateProfile.timeWindowMs = timeWindowMs;
        tDateProfile.normalizedRange = { start: normalizedStart, end: normalizedEnd };
        // Timed axes slice/position in instant (epoch-ms) space and are sourced from a canonical
        // epoch-driven builder. Whole-day axes stay in civil space and keep the
        // dateEnv.add/dateEnv.countDurationsBetween arithmetic below.
        tDateProfile.timeAxis = tDateProfile.isTimeScale
            ? buildTimelineTimeAxis({
                normalizedRange: tDateProfile.normalizedRange,
                slotDuration: tDateProfile.slotDuration,
                snapDuration: tDateProfile.snapDuration,
                timeWindowMs,
                dateEnv,
                isDateVisible: (date) => isValidDate(date, tDateProfile, dateProfile, dateProfileGenerator),
            })
            : null;
        let slotDates = [];
        let slotKeys;
        let majorUnit = protectedApi.computeMajorUnit(dateProfile, dateEnv);
        if (tDateProfile.timeAxis) {
            slotDates = tDateProfile.timeAxis.slots.map((slot) => slot.date);
            slotKeys = tDateProfile.timeAxis.slots.map((slot) => slot.key);
        }
        else {
            let date = normalizedStart;
            while (date < normalizedEnd) {
                if (isValidDate(date, tDateProfile, dateProfile, dateProfileGenerator)) {
                    slotDates.push(date);
                }
                date = dateEnv.add(date, tDateProfile.slotDuration);
            }
            slotKeys = slotDates.map((slotDate) => slotDate.toISOString());
        }
        tDateProfile.slotDates = slotDates;
        tDateProfile.slotKeys = slotKeys;
        tDateProfile.slotDatesMajor = slotDates.map((slotDate) => protectedApi.isMajorUnit(slotDate, majorUnit, dateEnv));
        if (tDateProfile.timeAxis) {
            // visible slots are the authority for timed-axis geometry. a DST-transition day is not
            // necessarily divisible by slotDuration, so slotCnt must NOT be derived from snap counts
            tDateProfile.snapDiffToIndex = []; // only consulted by the civil day-axis coverage path
            tDateProfile.snapCnt = tDateProfile.timeAxis.slots.length * tDateProfile.snapsPerSlot;
            tDateProfile.slotCnt = tDateProfile.timeAxis.slots.length;
        }
        else {
            let snapIndex = -1;
            const snapDiffToIndex = [];
            let date = normalizedStart;
            while (date < normalizedEnd) {
                if (isValidDate(date, tDateProfile, dateProfile, dateProfileGenerator)) {
                    snapIndex += 1;
                    snapDiffToIndex.push(snapIndex);
                }
                else {
                    snapDiffToIndex.push(snapIndex + 0.5);
                }
                date = dateEnv.add(date, tDateProfile.snapDuration);
            }
            tDateProfile.snapDiffToIndex = snapDiffToIndex;
            tDateProfile.snapCnt = snapIndex + 1; // is always one behind
            tDateProfile.slotCnt = tDateProfile.snapCnt / tDateProfile.snapsPerSlot;
        }
        // more...
        tDateProfile.cellRows = buildCellRows(tDateProfile, dateEnv, majorUnit);
        tDateProfile.slotsPerLabel = protectedApi.wholeDivideDurations(tDateProfile.labelInterval, tDateProfile.slotDuration);
        return tDateProfile;
    }
    /*
    snaps to appropriate unit
    */
    function normalizeDate(date, tDateProfile, dateEnv) {
        let normalDate = date;
        if (!tDateProfile.isTimeScale) {
            normalDate = protectedApi.startOfDay(normalDate);
            if (tDateProfile.largeUnit) {
                normalDate = dateEnv.startOf(normalDate, tDateProfile.largeUnit);
            }
        }
        return normalDate;
    }
    /*
    snaps to appropriate unit
    */
    /*
    Time-scale axes include hours past midnight when slotMaxTime is beyond a day (#6394).
    Day-or-coarser axes ignore slotMinTime/slotMaxTime, so only check the current range for them.
    */
    function isNowInTimelineRange(nowDate, dateProfile, tDateProfile) {
        return protectedApi.rangeContainsMarker(dateProfile.currentRange, nowDate) || (tDateProfile.isTimeScale &&
            protectedApi.rangeContainsMarker(tDateProfile.normalizedRange, nowDate));
    }
    function normalizeRange(range, tDateProfile, dateEnv) {
        if (!tDateProfile.isTimeScale) {
            range = protectedApi.computeVisibleDayRange(range);
            if (tDateProfile.largeUnit) {
                let dayRange = range; // preserve original result
                range = {
                    start: dateEnv.startOf(range.start, tDateProfile.largeUnit),
                    end: dateEnv.startOf(range.end, tDateProfile.largeUnit),
                };
                // if date is partially through the interval, or is in the same interval as the start,
                // make the exclusive end be the *next* interval
                if (range.end.valueOf() !== dayRange.end.valueOf() || range.end <= range.start) {
                    range = {
                        start: range.start,
                        end: dateEnv.add(range.end, tDateProfile.slotDuration),
                    };
                }
            }
        }
        return range;
    }
    function isValidDate(date, tDateProfile, dateProfile, dateProfileGenerator) {
        if (dateProfileGenerator.isHiddenDay(date)) {
            return false;
        }
        if (tDateProfile.isTimeScale) {
            // determine if the time is within slotMinTime/slotMaxTime, which may have wacky values
            let day = protectedApi.startOfDay(date);
            let timeMs = date.valueOf() - day.valueOf();
            let ms = timeMs - protectedApi.asRoughMs(dateProfile.slotMinTime); // milliseconds since slotMinTime
            ms = ((ms % 86400000) + 86400000) % 86400000; // make negative values wrap to 24hr clock
            return ms < tDateProfile.timeWindowMs; // before the slotMaxTime?
        }
        return true;
    }
    function validateLabelAndSlot(tDateProfile, dateProfile, dateEnv) {
        const { currentRange } = dateProfile;
        // make sure labelInterval doesn't exceed the max number of cells
        if (tDateProfile.labelInterval) {
            const labelCnt = dateEnv.countDurationsBetween(currentRange.start, currentRange.end, tDateProfile.labelInterval);
            if (labelCnt > protectedApi.config.MAX_TIMELINE_SLOTS) {
                protectedApi.warn('Invalid option `slotHeaderInterval`: too many timeline cells.');
                tDateProfile.labelInterval = null;
            }
        }
        // make sure slotDuration doesn't exceed the maximum number of cells
        if (tDateProfile.slotDuration) {
            const slotCnt = dateEnv.countDurationsBetween(currentRange.start, currentRange.end, tDateProfile.slotDuration);
            if (slotCnt > protectedApi.config.MAX_TIMELINE_SLOTS) {
                protectedApi.warn('Invalid option `slotDuration`: too many timeline cells.');
                tDateProfile.slotDuration = null;
            }
        }
        // make sure labelInterval is a multiple of slotDuration
        if (tDateProfile.labelInterval && tDateProfile.slotDuration) {
            const slotsPerLabel = protectedApi.wholeDivideDurations(tDateProfile.labelInterval, tDateProfile.slotDuration);
            if (slotsPerLabel === null || slotsPerLabel < 1) {
                protectedApi.warn('Invalid option `slotHeaderInterval`: must be a multiple of `slotDuration`.');
                tDateProfile.slotDuration = null;
            }
        }
    }
    function ensureLabelInterval(tDateProfile, dateProfile, dateEnv) {
        const { currentRange } = dateProfile;
        let { labelInterval } = tDateProfile;
        if (!labelInterval) {
            // compute based off the slot duration
            // find the largest label interval with an acceptable slots-per-label
            let input;
            if (tDateProfile.slotDuration) {
                for (input of STOCK_SUB_DURATIONS) {
                    const tryLabelInterval = protectedApi.createDuration(input);
                    const slotsPerLabel = protectedApi.wholeDivideDurations(tryLabelInterval, tDateProfile.slotDuration);
                    if (slotsPerLabel !== null && slotsPerLabel <= MAX_AUTO_SLOTS_PER_LABEL) {
                        labelInterval = tryLabelInterval;
                        break;
                    }
                }
                // use the slot duration as a last resort
                if (!labelInterval) {
                    labelInterval = tDateProfile.slotDuration;
                }
                // compute based off the view's duration
                // find the largest label interval that yields the minimum number of labels
            }
            else {
                for (input of STOCK_SUB_DURATIONS) {
                    labelInterval = protectedApi.createDuration(input);
                    const labelCnt = dateEnv.countDurationsBetween(currentRange.start, currentRange.end, labelInterval);
                    if (labelCnt >= MIN_AUTO_LABELS) {
                        break;
                    }
                }
            }
            tDateProfile.labelInterval = labelInterval;
        }
        return labelInterval;
    }
    function ensureSlotDuration(tDateProfile, dateProfile, dateEnv) {
        const { currentRange } = dateProfile;
        let { slotDuration } = tDateProfile;
        if (!slotDuration) {
            const labelInterval = ensureLabelInterval(tDateProfile, dateProfile, dateEnv); // will compute if necessary
            // compute based off the label interval
            // find the largest slot duration that is different from labelInterval, but still acceptable
            for (let input of STOCK_SUB_DURATIONS) {
                const trySlotDuration = protectedApi.createDuration(input);
                const slotsPerLabel = protectedApi.wholeDivideDurations(labelInterval, trySlotDuration);
                if (slotsPerLabel !== null && slotsPerLabel > 1 && slotsPerLabel <= MAX_AUTO_SLOTS_PER_LABEL) {
                    slotDuration = trySlotDuration;
                    break;
                }
            }
            // only allow the value if it won't exceed the view's # of slots limit
            if (slotDuration) {
                const slotCnt = dateEnv.countDurationsBetween(currentRange.start, currentRange.end, slotDuration);
                if (slotCnt > MAX_AUTO_CELLS) {
                    slotDuration = null;
                }
            }
            // use the label interval as a last resort
            if (!slotDuration) {
                slotDuration = labelInterval;
            }
            tDateProfile.slotDuration = slotDuration;
        }
        return slotDuration;
    }
    function computeHeaderFormats(tDateProfile, dateProfile, dateEnv, allOptions) {
        let format1;
        let format2;
        let unit1 = null;
        let unit2 = null;
        const { labelInterval } = tDateProfile;
        const { currentRange } = dateProfile;
        let unit = protectedApi.greatestDurationDenominator(labelInterval).unit;
        const weekNumbersVisible = allOptions.weekNumbers;
        let format0 = (format1 = (format2 = null));
        let unit0 = null;
        // NOTE: weekNumber computation function wont work
        if ((unit === 'week') && !weekNumbersVisible) {
            unit = 'day';
        }
        switch (unit) {
            case 'year':
                format0 = { year: 'numeric' }; // '2015'
                unit0 = 'year';
                break;
            case 'month':
                if (dateEnv.diffWholeYears(currentRange.start, currentRange.end) > 1) {
                    format0 = { year: 'numeric' }; // '2015'
                    unit0 = 'year';
                }
                format1 = { month: 'short' }; // 'Jan'
                unit1 = 'month';
                break;
            case 'week':
                if (dateEnv.diffWholeYears(currentRange.start, currentRange.end) > 1) {
                    format0 = { year: 'numeric' }; // '2015'
                    unit0 = 'year';
                }
                format1 = { week: 'narrow' }; // 'Wk4'
                unit1 = 'week';
                break;
            case 'day':
                if (dateEnv.diffWholeYears(currentRange.start, currentRange.end) > 1) {
                    format0 = { year: 'numeric', month: 'long' }; // 'January 2014'
                    unit0 = 'month';
                }
                else if (dateEnv.diffWholeMonths(currentRange.start, currentRange.end) > 1) {
                    format0 = { month: 'long' }; // 'January'
                    unit0 = 'month';
                }
                if (weekNumbersVisible) {
                    format1 = { week: 'short' }; // 'Wk 4'
                    unit1 = 'week';
                }
                format2 = { weekday: 'narrow', day: 'numeric' }; // 'Su 9'
                unit2 = 'day';
                break;
            case 'hour':
                if (weekNumbersVisible) {
                    format0 = { week: 'short' }; // 'Wk 4'
                    unit0 = 'week';
                }
                if (protectedApi.diffWholeDays(currentRange.start, currentRange.end) > 1) {
                    format1 = { weekday: 'short', day: 'numeric', month: 'numeric', omitCommas: true }; // Sat 4/7
                    unit1 = 'day';
                }
                format2 = {
                    hour: 'numeric',
                    minute: '2-digit',
                    omitZeroMinute: true,
                    meridiem: 'short',
                };
                unit2 = null;
                break;
            case 'minute':
                // sufficiently large number of different minute cells?
                if ((protectedApi.asRoughMinutes(labelInterval) / 60) >= MAX_AUTO_SLOTS_PER_LABEL) {
                    format0 = {
                        hour: 'numeric',
                        meridiem: 'short',
                    };
                    format1 = (params) => (':' + protectedApi.padStart(params.date.minute, 2) // ':30'
                    );
                }
                else {
                    format0 = {
                        hour: 'numeric',
                        minute: 'numeric',
                        meridiem: 'short',
                    };
                }
                break;
            case 'second':
                // sufficiently large number of different second cells?
                if ((protectedApi.asRoughSeconds(labelInterval) / 60) >= MAX_AUTO_SLOTS_PER_LABEL) {
                    format0 = { hour: 'numeric', minute: '2-digit', meridiem: 'lowercase' }; // '8:30 PM'
                    format1 = (params) => (':' + protectedApi.padStart(params.date.second, 2) // ':30'
                    );
                }
                else {
                    format0 = { hour: 'numeric', minute: '2-digit', second: '2-digit', meridiem: 'lowercase' }; // '8:30:45 PM'
                }
                break;
            case 'millisecond':
                format0 = { hour: 'numeric', minute: '2-digit', second: '2-digit', meridiem: 'lowercase' }; // '8:30:45 PM'
                format1 = (params) => ('.' + protectedApi.padStart(params.millisecond, 3));
                break;
        }
        return {
            formats: [].concat(format0 || [], format1 || [], format2 || []),
            units: [].concat(format0 ? [unit0] : [], format1 ? [unit1] : [], format2 ? [unit2] : []),
        };
    }
    function inferHeaderFormatUnit(rawFormat) {
        if (typeof rawFormat === 'object' && rawFormat) {
            if (rawFormat.fractionalSecondDigits ||
                rawFormat.second ||
                rawFormat.minute ||
                rawFormat.hour ||
                rawFormat.timeZoneName) {
                return 'time';
            }
            if (rawFormat.day || rawFormat.weekday) {
                return 'day';
            }
            if (rawFormat.week) {
                return 'week';
            }
            if (rawFormat.month) {
                return 'month';
            }
            if (rawFormat.year) {
                return 'year';
            }
        }
        return null;
    }
    function buildCellRows(tDateProfile, dateEnv, majorUnit) {
        let slotDates = tDateProfile.slotDates;
        const timeSlots = tDateProfile.timeAxis?.slots;
        let formats = tDateProfile.headerFormats;
        let cellRows = formats.map(() => []); // indexed by row,col
        let slotAsDays = protectedApi.asCleanDays(tDateProfile.slotDuration);
        let guessedSlotUnit = slotAsDays === 7 ? 'week' :
            slotAsDays === 1 ? 'day' :
                null;
        // specifically for navclicks
        let rowUnitsFromFormats = tDateProfile.headerFormatUnits;
        // builds cellRows and slotCells
        for (let i = 0; i < (timeSlots?.length ?? slotDates.length); i += 1) {
            const timeSlot = timeSlots?.[i];
            let date = timeSlot?.date ?? slotDates[i];
            const startMs = timeSlot?.startMs ?? null;
            for (let row = 0; row < formats.length; row += 1) {
                let format = formats[row];
                let rowCells = cellRows[row];
                let leadingCell = rowCells[rowCells.length - 1];
                let isLastRow = row === formats.length - 1;
                let isSuperRow = formats.length > 1 && !isLastRow; // more than one row and not the last
                let isMajor = protectedApi.isMajorUnit(date, majorUnit, dateEnv);
                let newCell = null;
                let rowUnit = rowUnitsFromFormats[row] || (isLastRow ? guessedSlotUnit : null);
                const key = rowUnit + ':' + (timeSlot?.key ?? tDateProfile.slotKeys[i]);
                if (isSuperRow) {
                    let textParts = formatCell(date, startMs, format, dateEnv);
                    if (!leadingCell || (leadingCell.text !== joinDateTimeFormatParts(textParts))) {
                        newCell = buildCellObject(key, date, startMs, isMajor, textParts, rowUnit);
                    }
                    else {
                        leadingCell.colspan += 1;
                    }
                }
                else if (!leadingCell ||
                    protectedApi.isInt(dateEnv.countDurationsBetween(tDateProfile.normalizedRange.start, date, tDateProfile.labelInterval))) {
                    let textParts = formatCell(date, startMs, format, dateEnv);
                    newCell = buildCellObject(key, date, startMs, isMajor, textParts, rowUnit);
                }
                else {
                    leadingCell.colspan += 1;
                }
                if (newCell) {
                    rowCells.push(newCell);
                }
            }
        }
        return cellRows;
    }
    /*
    startMs is null for every cell of a non-timed timeline (slot unit of day or coarser),
    where cells are civil dates without an exact instant. Timed-axis cells always carry one,
    keeping their labels fold-correct during DST. Passing undefined lets DateEnv resolve the
    marker first-occurrence — the occurrence choice can't affect a date-only label.
    */
    function formatCell(date, startMs, format, dateEnv) {
        return dateEnv.formatToParts(date, format, {
            instantMs: startMs ?? undefined,
        });
    }
    function buildCellObject(key, date, startMs, isMajor, textParts, rowUnit) {
        const text = joinDateTimeFormatParts(textParts);
        return { key, date, startMs, isMajor, text, textParts, rowUnit, colspan: 1 }; // colspan mutated later
    }

    /*
    TODO: rename this file!
    */
    /*
    For WHOLE-DAY axes only. Timed axes use computeMsSlotCoverage instead.
    Returned value is between 0 and the number of snaps.
    */
    function computeDateSnapCoverage(date, tDateProfile, dateEnv) {
        let snapDiff = dateEnv.countDurationsBetween(tDateProfile.normalizedRange.start, date, tDateProfile.snapDuration);
        if (snapDiff < 0) {
            return 0;
        }
        if (snapDiff >= tDateProfile.snapDiffToIndex.length) {
            return tDateProfile.snapCnt;
        }
        let snapDiffInt = Math.floor(snapDiff);
        let snapCoverage = tDateProfile.snapDiffToIndex[snapDiffInt];
        if (protectedApi.isInt(snapCoverage)) { // not an in-between value
            snapCoverage += snapDiff - snapDiffInt; // add the remainder
        }
        else {
            // a fractional value, meaning the date is not visible
            // always round up in this case. works for start AND end dates in a range.
            snapCoverage = Math.ceil(snapCoverage);
        }
        return snapCoverage;
    }
    /*
    For TIMED axes only (tDateProfile.timeAxis must be populated).
    Returned value is in SLOT units, between 0 and the number of visible slots.
    Interpolates within each slot's real instant span, so slots keep their rendered width even
    when a DST transition makes their real spans unequal. Instants between visible slots
    (hidden times) collapse to the boundary coordinate.
    */
    function computeMsSlotCoverage(dateMs, tDateProfile) {
        const { slots } = tDateProfile.timeAxis;
        if (!slots.length || dateMs <= slots[0].startMs) {
            return 0;
        }
        if (dateMs >= slots[slots.length - 1].endMs) {
            return slots.length;
        }
        const slotIndex = findLastSlotIndex(slots, dateMs);
        const slot = slots[slotIndex];
        const clampedMs = Math.min(dateMs, slot.endMs);
        return slotIndex + (clampedMs - slot.startMs) / (slot.endMs - slot.startMs);
    }
    /*
    Binary search for the largest index whose slot starts at-or-before dateMs.
    Caller must ensure dateMs is within (slots[0].startMs, axis end).
    */
    function findLastSlotIndex(slots, dateMs) {
        let lo = 0;
        let hi = slots.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (slots[mid].startMs <= dateMs) {
                lo = mid;
            }
            else {
                hi = mid - 1;
            }
        }
        return lo;
    }

    // Timeline-specific
    // -------------------------------------------------------------------------------------------------
    /*
    TODO: DRY with computeSlatHeight?
    */
    function computeSlotWidth(slatCnt, slatsPerLabel, slatMinWidth, labelInnerWidth, viewportWidth) {
        if (labelInnerWidth == null || viewportWidth == null) {
            return [undefined, undefined, false];
        }
        if (slatMinWidth == null) {
            slatMinWidth = Math.ceil((labelInnerWidth + 1) / slatsPerLabel);
        }
        const slatTryWidth = viewportWidth / slatCnt;
        let slotLiquid;
        let slatWidth;
        if (slatTryWidth >= slatMinWidth) {
            slotLiquid = true;
            slatWidth = slatTryWidth;
        }
        else {
            slotLiquid = false;
            slatWidth = Math.max(slatMinWidth, slatTryWidth);
        }
        return [slatWidth * slatCnt, slatWidth, slotLiquid];
    }
    /*
    `time` has wall-clock semantics (scrollTime: '06:00' targets civil 06:00, even on DST days
    where that's not 6 elapsed hours from midnight), hence the civil dateEnv.add.
    */
    function timeToCoord(// pixels
    time, dateEnv, dateProfile, tDateProfile, slotWidth) {
        let date = dateEnv.add(dateProfile.activeRange.start, time);
        if (!tDateProfile.isTimeScale) {
            date = protectedApi.startOfDay(date);
        }
        return dateToCoord(date, dateEnv, tDateProfile, slotWidth);
    }
    function dateToCoord(// pixels
    date, dateEnv, tDateProfile, slotWidth) {
        if (tDateProfile.timeAxis) {
            return msToCoord(dateEnv.toDate(date).valueOf(), tDateProfile, slotWidth);
        }
        let snapCoverage = computeDateSnapCoverage(date, tDateProfile, dateEnv);
        let slotCoverage = snapCoverage / tDateProfile.snapsPerSlot;
        return slotCoverage * slotWidth;
    }
    // for TIMED axes only (tDateProfile.timeAxis must be populated)
    function msToCoord(// pixels
    dateMs, tDateProfile, slotWidth) {
        return computeMsSlotCoverage(dateMs, tDateProfile) * slotWidth;
    }
    /**
     * Projects one seg onto the slot axis, as a range rather than a span.
     *
     * Both endpoints come from the projection. That matters because placement
     * compares one seg's `end` against the next seg's `start` with no tolerance,
     * and deriving an end as `start + size` does not agree bit-for-bit with a
     * projected one: `(s - c) + (e - s)` can land an ulp above `e - c` even though
     * they are algebraically equal. That is enough to read two abutting events as
     * overlapping and spend a whole extra level on them — measurably, for roughly
     * one adjacency in 250 at ordinary liquid slot widths.
     *
     * A projected end is trustworthy because projection is deterministic: the same
     * instant through `msToCoord` twice is bit-identical, so an end taken from it
     * equals the neighbor's start exactly. Returning no `size` is deliberate — it
     * leaves nothing to rebuild an end from. Callers wanting a CSS width take
     * `end - start`, where an ulp cannot render anyway.
     *
     * The one derived endpoint is a seg stretched to `segMinWidth`, which has no
     * projected end to keep.
     */
    function computeSegHorizontals(seg, segMinWidth, dateEnv, tDateProfile, slotWidth, clipStart = 0, // uses it as a new origin!
    clipEnd = Infinity) {
        // segs on timed axes always carry exact instants; whole-day axes position by civil marker
        let startCoord = seg.startMs != null
            ? msToCoord(seg.startMs, tDateProfile, slotWidth)
            : dateToCoord(seg.startDate, dateEnv, tDateProfile, slotWidth);
        let endCoord = seg.endMs != null
            ? msToCoord(seg.endMs, tDateProfile, slotWidth)
            : dateToCoord(seg.endDate, dateEnv, tDateProfile, slotWidth);
        startCoord = Math.max(startCoord, clipStart);
        endCoord = Math.min(endCoord, clipEnd);
        if (startCoord < endCoord) {
            const start = startCoord - clipStart;
            let end = endCoord - clipStart;
            if (segMinWidth && end - start < segMinWidth) {
                end = start + segMinWidth;
            }
            return { start, end };
        }
    }
    /*
    Builds the horizontal geometry and exact date span shared by both timeline hit systems.
    */
    function computeTimelineHitData(positionLeft, canvasWidth, slotWidth, isRtl, tDateProfile, dateEnv) {
        const x = isRtl ? canvasWidth - positionLeft : positionLeft;
        const slatIndex = Math.floor(x / slotWidth);
        const slatLeft = slatIndex * slotWidth;
        const partial = (x - slatLeft) / slotWidth;
        const localSnapIndex = Math.floor(partial * tDateProfile.snapsPerSlot);
        const snap = computeSnapRange(slatIndex, localSnapIndex, tDateProfile, dateEnv);
        if (!snap) {
            return null;
        }
        const snapWidth = slotWidth / tDateProfile.snapsPerSlot;
        const startCoord = slatIndex * slotWidth + (snapWidth * localSnapIndex);
        const endCoord = startCoord + snapWidth;
        const left = isRtl ? canvasWidth - endCoord : startCoord;
        const right = isRtl ? canvasWidth - startCoord : endCoord;
        return {
            slatIndex,
            dateSpan: {
                range: { start: snap.start, end: snap.end },
                allDay: !tDateProfile.isTimeScale,
                ...(snap.startMs != null ? {
                    instantStartMs: snap.startMs,
                    instantEndMs: snap.endMs,
                } : {}),
            },
            rect: { left, right },
        };
    }
    /*
    The date range of a single snap-cell, for hit-detection.
    Timed axes read the canonical instant-based axis; whole-day axes use civil-marker arithmetic.
    Returns null when the snap has no real span (e.g. the tail of a slot truncated by a DST
    transition, which renders at full width but represents a shorter real duration).
    */
    function computeSnapRange(slatIndex, localSnapIndex, // the snap # relative to start of slat
    tDateProfile, dateEnv) {
        const { timeAxis } = tDateProfile;
        if (timeAxis) {
            if (slatIndex >= timeAxis.slots.length) {
                return null;
            }
            const slot = timeAxis.slots[slatIndex];
            const startMs = slot.startMs + (localSnapIndex * timeAxis.snapStepMs);
            const endMs = Math.min(startMs + timeAxis.snapStepMs, slot.endMs);
            if (startMs >= endMs) {
                return null;
            }
            return {
                start: dateEnv.timestampToMarker(startMs),
                end: dateEnv.timestampToMarker(endMs),
                startMs,
                endMs,
            };
        }
        if (slatIndex >= tDateProfile.slotDates.length) {
            return null;
        }
        const start = dateEnv.add(tDateProfile.slotDates[slatIndex], protectedApi.multiplyDuration(tDateProfile.snapDuration, localSnapIndex));
        return {
            start,
            end: dateEnv.add(start, tDateProfile.snapDuration),
            startMs: null,
            endMs: null,
        };
    }

    /*
    Timed axes (tDateProfile.timeAxis) slice in instant (epoch-ms) space so DST gaps/folds
    position correctly. Whole-day axes slice in civil-marker space.
    */
    class TimelineLaneSlicer extends protectedApi.Slicer {
        intersectDateSpan(dateSpan, activeRange, dateProfile, dateProfileGenerator, tDateProfile, dateEnv) {
            if (!tDateProfile.timeAxis) {
                return super.intersectDateSpan(dateSpan, activeRange, dateProfile, dateProfileGenerator, tDateProfile, dateEnv);
            }
            const startMs = Math.max(protectedApi.getDateSpanInstantStartMs(dateSpan, dateEnv), dateEnv.toDate(activeRange.start).valueOf());
            const endMs = Math.min(protectedApi.getDateSpanInstantEndMs(dateSpan, dateEnv), dateEnv.toDate(activeRange.end).valueOf());
            if (startMs < endMs) {
                const range = protectedApi.buildValidInstanceRange({ marker: dateEnv.timestampToMarker(startMs), instantMs: startMs }, { marker: dateEnv.timestampToMarker(endMs), instantMs: endMs }, dateEnv);
                if (!range) {
                    return null;
                }
                return {
                    ...dateSpan,
                    range: { start: range.start, end: range.end },
                    instantStartMs: startMs,
                    instantEndMs: endMs,
                };
            }
            return null;
        }
        sliceDateSpan(dateSpan, dateProfile, dateProfileGenerator, tDateProfile, dateEnv) {
            if (!tDateProfile.timeAxis) {
                return super.sliceDateSpan(dateSpan, dateProfile, dateProfileGenerator, tDateProfile, dateEnv);
            }
            return sliceInstantSpan(protectedApi.getDateSpanInstantStartMs(dateSpan, dateEnv), protectedApi.getDateSpanInstantEndMs(dateSpan, dateEnv), dateProfile, dateProfileGenerator, tDateProfile, dateEnv);
        }
        sliceRange(origRange, dateProfile, dateProfileGenerator, tDateProfile, dateEnv) {
            if (tDateProfile.timeAxis) {
                return sliceInstantSpan(protectedApi.getRangeInstantStartMs(origRange, dateEnv), protectedApi.getRangeInstantEndMs(origRange, dateEnv), dateProfile, dateProfileGenerator, tDateProfile, dateEnv);
            }
            let normalRange = normalizeRange(origRange, tDateProfile, dateEnv);
            let segs = [];
            // protect against when the span is entirely in an invalid date region
            if (computeDateSnapCoverage(normalRange.start, tDateProfile, dateEnv)
                < computeDateSnapCoverage(normalRange.end, tDateProfile, dateEnv)) {
                // intersect the footprint's range with the grid's range
                let slicedRange = protectedApi.intersectRanges(normalRange, tDateProfile.normalizedRange);
                if (slicedRange) {
                    segs.push({
                        startDate: slicedRange.start,
                        endDate: slicedRange.end,
                        isStart: slicedRange.start.valueOf() === normalRange.start.valueOf()
                            && isValidDate(slicedRange.start, tDateProfile, dateProfile, dateProfileGenerator),
                        isEnd: slicedRange.end.valueOf() === normalRange.end.valueOf()
                            && isValidDate(protectedApi.addMs(slicedRange.end, -1), tDateProfile, dateProfile, dateProfileGenerator),
                    });
                }
            }
            return segs;
        }
    }
    function sliceInstantSpan(origStartMs, origEndMs, dateProfile, dateProfileGenerator, tDateProfile, dateEnv) {
        const axisStartMs = getTimelineAxisStartMs(tDateProfile.timeAxis);
        const axisEndMs = getTimelineAxisEndMs(tDateProfile.timeAxis);
        if (axisStartMs == null) { // axis has no visible slots
            return [];
        }
        // intersect the footprint's range with the grid's range
        const startMs = Math.max(origStartMs, axisStartMs);
        const endMs = Math.min(origEndMs, axisEndMs);
        if (startMs < endMs &&
            // protect against when the span is entirely in an invalid date region
            computeMsSlotCoverage(startMs, tDateProfile) < computeMsSlotCoverage(endMs, tDateProfile)) {
            const startDate = dateEnv.timestampToMarker(startMs);
            const endDate = dateEnv.timestampToMarker(endMs);
            return [{
                    startDate,
                    endDate,
                    startMs,
                    endMs,
                    isStart: startMs === origStartMs
                        && isValidDate(startDate, tDateProfile, dateProfile, dateProfileGenerator),
                    isEnd: endMs === origEndMs
                        && isValidDate(dateEnv.timestampToMarker(endMs - 1), tDateProfile, dateProfile, dateProfileGenerator),
                }];
        }
        return [];
    }

    /**
     * Slot width assumed on the first render, before the real one is measured.
     * Shared by standalone Timeline and Resource Timeline.
     *
     * Without it, `computeSegHorizontals` projects every seg to zero width and
     * drops it, so the lane paints a frame containing no events at all and the
     * calendar looks empty until measurement lands. Projecting against an assumed
     * width instead means events are present in that very first paint.
     *
     * A flat constant is enough, and deliberately so. Placement compares segs
     * against each other and never against the axis length, so in exact arithmetic
     * scaling every coordinate by the same factor preserves the lateral collision
     * graph and the unit-thickness candidate plan among the segs that project. That
     * is why callers withhold `eventMinWidth` while assuming — a pixel floor applied
     * at the wrong scale would stretch the wrong segs, and stretching is what
     * creates collisions.
     *
     * That is a much weaker promise than "the layout comes out the same", and
     * deliberately so. Four things can still differ once the width is real:
     *
     * - `eventMinWidth` comes back on, and stretching a sub-minimum seg can make it
     *   collide with a neighbor it previously cleared, changing level assignment
     *   and admission under `eventMaxStack`.
     * - Wrapper heights are measured at the rendered width, and a narrower bar
     *   wraps its content taller; that thickness feeds level fitting.
     * - The virtualized clip window can settle on a different slot range, changing
     *   which segs project at all.
     * - Scale invariance is exact only in real arithmetic, so an adjacency sitting
     *   on the last bit may still resolve one way when assumed and the other way
     *   when measured. Both endpoints now come straight from the projection, which
     *   removes the systematic source of this, but does not make float arithmetic
     *   scale-invariant in general.
     *
     * So the assumed pass is a good-faith first draft, not a guarantee about the
     * measured one. Anything latched from it upward — a reported height, say —
     * needs to wait for a measured width instead.
     */
    const ESTIMATED_SLOT_WIDTH = 50;
    /** Resolves event projection dimensions before and after slot measurement. */
    function resolveTimelineEventProjectionSizing(slotWidth, eventMinWidth) {
        return {
            slotWidth: slotWidth ?? ESTIMATED_SLOT_WIDTH,
            eventMinWidth: slotWidth != null ? eventMinWidth : undefined,
        };
    }

    class TimelineBg extends protectedApi.BaseComponent {
        render() {
            let { props } = this;
            let highlightSeg = [].concat(props.eventResizeSegs || [], props.dateSelectionSegs || []);
            return (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [this.renderSegs(props.businessHourSegs || [], 'non-business'), this.renderSegs(props.bgEventSegs || [], 'bg-event'), this.renderSegs(highlightSeg, 'highlight')] }));
        }
        renderSegs(segs, fillType) {
            const { props, context } = this;
            const { dateEnv, options } = context;
            const { tDateProfile, todayRange, nowDate } = props;
            const clipStart = props.clipStart ?? 0;
            const clipEnd = props.clipEnd ?? Infinity;
            // fills follow the same assumed-then-measured path as events, so the first
            // paint isn't missing its background while the foreground is present
            const slotWidth = props.slotWidth ?? ESTIMATED_SLOT_WIDTH;
            return (jsxRuntime.jsx(jsxRuntime.Fragment, { children: segs.map((seg) => {
                    const horizontal = computeSegHorizontals(seg, undefined, dateEnv, tDateProfile, slotWidth);
                    if (horizontal) {
                        let { start, end } = horizontal;
                        start = Math.max(start, clipStart);
                        end = Math.min(end, clipEnd);
                        if (start < end) {
                            return (jsxRuntime.jsx("div", { "aria-hidden": true, className: classNames__default["default"].fillY, style: {
                                    insetInlineStart: start - clipStart,
                                    width: end - start,
                                }, children: fillType === 'bg-event' ? (jsxRuntime.jsx(protectedApi.BgEvent, { eventRange: seg.eventRange, isStart: seg.isStart, isEnd: seg.isEnd, isVertical: false, renderProps: props.renderProps, ...protectedApi.getEventRangeMeta(seg.eventRange, todayRange, nowDate, props.nowMs) })) : (protectedApi.renderFill(fillType, options)) }, protectedApi.buildEventRangeKey(seg.eventRange)));
                        }
                    }
                }) }));
        }
    }

    class TimelineHeaderCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memo
            this.getDateMeta = protectedApi.memoize(protectedApi.getDateMeta);
            this.applyExactSlotMeta = protectedApi.memoize(applyExactSlotMeta);
            // ref
            this.innerWrapperElRef = compat.createRef();
        }
        render() {
            let { props, state, context } = this;
            let { dateEnv, options } = context;
            let { cell, dateProfile, tDateProfile } = props;
            // the cell.rowUnit is f'd
            // giving 'month' for a 3-day view
            // workaround: to infer day, do NOT time
            let dateMeta = this.applyExactSlotMeta(this.getDateMeta(cell.date, dateEnv, dateProfile, props.todayRange, props.nowDate), cell.startMs, props.nowMs);
            let hasNavLink = options.navLinks && !dateMeta.isDisabled && (cell.rowUnit && cell.rowUnit !== 'time');
            let isTime = tDateProfile.isTimeScale && !props.rowLevel; // HACK: faulty way of determining this
            let { textParts } = cell;
            let renderProps = {
                ...dateMeta,
                level: props.rowLevel,
                isMajor: cell.isMajor,
                isMinor: false,
                isNarrow: false,
                isTime,
                hasNavLink,
                text: cell.text,
                textParts,
                get weekdayText() { return protectedApi.findWeekdayText(textParts); },
                get dayNumberText() { return protectedApi.findDayNumberText(textParts); },
                get monthText() { return protectedApi.findMonthText(textParts); },
                isFirst: props.isFirst,
                view: context.viewApi,
            };
            const { slotHeaderAlign } = options;
            const align = this.align =
                typeof slotHeaderAlign === 'function'
                    ? slotHeaderAlign({ level: props.rowLevel, isTime })
                    : slotHeaderAlign;
            const isSticky = this.isSticky =
                props.rowLevel && options.slotHeaderSticky !== false;
            let edgeCoord;
            if (isSticky) {
                if (align === 'center') {
                    if (state.innerWidth != null) {
                        edgeCoord = `calc(50% - ${state.innerWidth / 2}px)`;
                    }
                }
                else {
                    edgeCoord = (typeof options.slotHeaderSticky === 'number' ||
                        typeof options.slotHeaderSticky === 'string') ? options.slotHeaderSticky : 0;
                }
            }
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "div", className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noPadding, classNames__default["default"].flexCol, classNames__default["default"].borderlessY, classNames__default["default"].borderlessEnd, props.isFirst && classNames__default["default"].borderlessStart, align === 'center' ? classNames__default["default"].alignCenter :
                    align === 'end' ? classNames__default["default"].alignEnd :
                        classNames__default["default"].alignStart, classNames__default["default"].internalTimelineSlot), attrs: {
                    'data-date': dateEnv.formatIso(cell.date, {
                        omitTime: !tDateProfile.isTimeScale,
                        omitTimeZoneOffset: true,
                    }),
                    ...(dateMeta.isToday ? { 'aria-current': 'date' } : {}),
                }, style: {
                    width: props.slotWidth != null
                        ? props.slotWidth * cell.colspan
                        : undefined,
                }, renderProps: renderProps, generatorName: "slotHeaderContent", customGenerator: options.slotHeaderContent, defaultGenerator: renderInnerContent, classNameGenerator: options.slotHeaderClass, didMount: options.slotHeaderDidMount, willUnmount: options.slotHeaderWillUnmount, children: (InnerContent) => (jsxRuntime.jsx("div", { ref: this.innerWrapperElRef, className: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, isSticky && classNames__default["default"].sticky), style: {
                        left: edgeCoord,
                        right: edgeCoord,
                    }, children: jsxRuntime.jsx(InnerContent, { tag: "div", attrs: hasNavLink
                            // not tabbable because parent is aria-hidden
                            ? protectedApi.buildNavLinkAttrs(context, cell.date, cell.rowUnit, undefined, 
                            /* isTabbable = */ false)
                            : {} // don't bother with aria-hidden because parent already hidden
                        , className: protectedApi.generateClassName(options.slotHeaderInnerClass, renderProps) }) })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            const { props } = this;
            const innerWrapperEl = this.innerWrapperElRef.current; // TODO: make dynamic with useEffect
            this.disconnectSize = protectedApi.watchSize(innerWrapperEl, (width, height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(props.innerWidthRef, width);
                protectedApi.setRef(props.innerHeightRef, height);
                if (this.align === 'center' && this.isSticky) {
                    this.setState({ innerWidth: width });
                }
            });
        }
        componentWillUnmount() {
            const { props } = this;
            this._isUnmounting = true;
            this.disconnectSize();
            protectedApi.setRef(props.innerWidthRef, null);
            protectedApi.setRef(props.innerHeightRef, null);
        }
    }
    // Utils
    // -------------------------------------------------------------------------------------------------
    function renderInnerContent(renderProps) {
        return renderProps.text;
    }

    class TimelineHeaderRow extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // refs
            // Remembers the widths of labels that virtualization has unmounted, so they still count toward
            // the slot width. Otherwise, slot width would depend on which labels are mounted, while which
            // labels are mounted depends on slot width. A widest label that only fits within the virtualized
            // window at narrower slots would widen the slots, unmount, narrow them, and mount again, forever.
            // A remembered width goes stale if the label's content changes while it's unmounted, such as with
            // a locale change, and slots stay too wide until it scrolls back into view.
            this.innerWidthRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleInnerWidths);
            }, /* ignoreDeletes = */ true);
            this.innerHeightRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleInnerHeights);
            });
            this.handleInnerWidths = () => {
                if (this._isUnmounting) {
                    return;
                }
                const innerWidthMap = this.innerWidthRefMap.current;
                let max = null;
                // Not all of the map's values. See innerWidthRefMap: it also retains labels of prior date ranges
                for (const cell of this.props.cells) {
                    const innerWidth = innerWidthMap.get(cell.key);
                    if (innerWidth != null) {
                        max = Math.max(max || 0, innerWidth);
                    }
                }
                // TODO: ensure not equal?
                protectedApi.setRef(this.props.innerWidthRef, max);
            };
            this.handleInnerHeights = () => {
                if (this._isUnmounting)
                    return;
                const innerHeightMap = this.innerHeightRefMap.current;
                let max = null;
                for (const innerHeight of innerHeightMap.values()) {
                    max = Math.max(max || 0, innerHeight);
                }
                // TODO: ensure not equal?
                protectedApi.setRef(this.props.innerHeighRef, max);
                this.setState({ innerHeight: max });
            };
        }
        render() {
            const { props, innerWidthRefMap, innerHeightRefMap, state, context } = this;
            const { options } = context;
            let { cells, cellStartIndex, cellCount } = props;
            cellStartIndex = cellStartIndex || 0;
            if (cellStartIndex || cellCount !== undefined) {
                cells = cells.slice(cellStartIndex, cellStartIndex + cellCount);
            }
            return (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(props.className, options.slotHeaderRowClass, classNames__default["default"].flexRow, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.rowLevel && classNames__default["default"].borderlessBottom), style: {
                    insetInlineStart: props.insetInlineStart,
                    width: props.width,
                    // we assign height because we allow cells to have distorted heights for visual effect
                    // but we still want to keep the overall extrenal mass
                    height: state.innerHeight,
                }, children: cells.map((cell, cellI) => {
                    // TODO: make this part of the cell obj?
                    // TODO: rowUnit seems wrong sometimes. says 'month' when it should be day
                    // TODO: rowUnit is relevant to whole row. put it on a row object, not the cells
                    // TODO: use rowUnit to key the Row itself?
                    const key = cell.key;
                    return (jsxRuntime.jsx(TimelineHeaderCell, { cell: cell, rowLevel: props.rowLevel, dateProfile: props.dateProfile, tDateProfile: props.tDateProfile, todayRange: props.todayRange, nowDate: props.nowDate, nowMs: props.nowMs, isFirst: cellStartIndex + cellI === 0, 
                        // refs
                        innerWidthRef: innerWidthRefMap.createRef(key), innerHeightRef: innerHeightRefMap.createRef(key), 
                        // dimensions
                        slotWidth: props.slotWidth }, key));
                }) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            protectedApi.setRef(this.props.innerWidthRef, null);
            protectedApi.setRef(this.props.innerHeighRef, null);
        }
    }

    /**
     * Builds shared-engine sources from production's already-projected spans.
     *
     * `orderIndex` is the index in the caller's resolved event-order array, even
     * when clipping removes an earlier seg.
     *
     * Coordinates go in exactly as projected, with no rounding or tolerance, which
     * is how this worked before the shared engine existed. Placement therefore
     * reacts to whatever the projection produces, down to the last bit: an overlap
     * of any width costs a whole level.
     *
     * That precision is only safe because the endpoints come from the projection
     * rather than being rebuilt from each other — see `TimelineSegHorizontals.end`,
     * which also covers the one case that is derived, a seg stretched to
     * `eventMinWidth`. Deriving the end as `start + size` would reintroduce
     * ulp-level disagreements between abutting events, which is exactly what a
     * quantizer would then have to hide.
     */
    function buildTimelineSegSources(segs, segMinWidth, dateEnv, tDateProfile, slotWidth, clipStart = 0, clipEnd = Infinity) {
        const sourceSegs = [];
        for (let orderIndex = 0; orderIndex < segs.length; orderIndex += 1) {
            const seg = segs[orderIndex];
            const horizontal = computeSegHorizontals(seg, segMinWidth, dateEnv, tDateProfile, slotWidth, clipStart, clipEnd);
            if (horizontal) {
                sourceSegs.push({
                    ...seg,
                    key: seg.eventRange.instance.instanceId,
                    start: horizontal.start,
                    end: horizontal.end,
                    orderIndex,
                });
            }
        }
        return sourceSegs;
    }
    /**
     * Mounts every admitted event for measurement, but positions only events whose
     * wrappers have reported an exact height. Link heights affect only content
     * height, never placement.
     */
    function buildTimelineSegPlacements(sourceSegs, eventOrderStrict, eventMaxStack, sliceHeights, moreLinkHeights) {
        const layout = protectedApi.buildLevelLimitedLayout(sourceSegs, eventOrderStrict, 
        /* eventSlicing = */ false, eventMaxStack, 
        /* moreLinkTakesLevel = */ false, sliceHeights);
        const renderSlices = protectedApi.sortByAxisOrder(layout.renderSlices);
        const hiddenGroups = protectedApi.groupLaterallyIntersecting(layout.hiddenSlices);
        const moreLinks = hiddenGroups.map((group) => ({
            key: group.key,
            start: group.start,
            end: group.end,
            top: protectedApi.computeLateralSpanBottom(layout.sliceLevels, group, layout.sliceCoords, sliceHeights),
            segs: group.hiddenSlices.map((slice) => slice.sourceSeg),
        }));
        return {
            renderSlices,
            sliceCoords: layout.sliceCoords,
            moreLinks,
            contentHeight: calculateTimelineContentHeight(renderSlices, layout.sliceCoords, sliceHeights, moreLinks, moreLinkHeights),
            isSettled: layout.isSettled,
        };
    }
    /** Visible bottoms plus each link's independently measured occupied space. */
    function calculateTimelineContentHeight(renderSlices, sliceCoords, sliceHeights, moreLinks, moreLinkHeights) {
        let contentHeight = 0;
        for (const slice of renderSlices) {
            const key = protectedApi.getSliceKey(slice);
            const sliceTop = sliceCoords.get(key);
            const sliceHeight = sliceHeights.get(key);
            if (sliceTop != null && sliceHeight != null) {
                contentHeight = Math.max(contentHeight, sliceTop + sliceHeight);
            }
        }
        for (const moreLink of moreLinks) {
            contentHeight = Math.max(contentHeight, moreLink.top + (moreLinkHeights.get(moreLink.key) ?? 0));
        }
        return contentHeight;
    }

    /** Projects complete Timeline geometry and plans print-only DOM candidates. */
    function buildTimelinePrintPlan(segs, dateEnv, tDateProfile, slotWidth, eventMinWidth, eventOrderStrict = false) {
        const sourceSegs = buildTimelineSegSources(segs, eventMinWidth, dateEnv, tDateProfile, slotWidth);
        return protectedApi.planPrintDomCandidates(sourceSegs, eventOrderStrict, false);
    }
    /** Builds normal-flow event bands and Timeline's one final more-link band. */
    function buildTimelinePrintLayout(plan, printSegHeights, printMoreLinkHeights) {
        return {
            eventBands: protectedApi.buildPrintEventBands(plan.sliceLevels, printSegHeights),
            moreLinkBand: protectedApi.buildPrintMoreLinkBand(protectedApi.groupLaterallyIntersecting(plan.hiddenSlices), printMoreLinkHeights),
        };
    }
    /**
     * The measurement half of Timeline print, shared by the standalone lane and
     * the resource row.
     *
     * Both renderers mount the same wrappers against the same two maps, so the
     * ownership rules live here once. Event wrappers ignore deletes because a
     * source can change bands when `slotWidth` changes, and a departing wrapper's
     * removal must not clobber the arriving wrapper's live entry.
     */
    class TimelinePrintHeights {
        /** `onSettled` must be a stable reference, since `afterSize` dedupes by it. */
        constructor(onSettled) {
            const handleChange = () => {
                protectedApi.afterSize(onSettled);
            };
            this.segHeightRefMap = new protectedApi.RefMap(handleChange, true);
            this.moreLinkHeightRefMap = new protectedApi.RefMap(handleChange);
        }
        buildLayout(plan) {
            return buildTimelinePrintLayout(plan, this.segHeightRefMap.current, this.moreLinkHeightRefMap.current);
        }
    }
    /**
     * Base for the two Timeline print renderers (standalone lane and resource
     * row). Owns the whole shared pipeline — sort → projection sizing → plan →
     * measured band layout — plus the measurement/settle lifecycle, so the two
     * renderers cannot silently diverge.
     */
    class TimelinePrintRenderer extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // memo
            this.sortSegs = protectedApi.memoize(protectedApi.sortEventSegs);
            this.buildPlan = protectedApi.memoize(buildTimelinePrintPlan);
            // refs
            this.printHeights = new TimelinePrintHeights(() => {
                if (!this._isUnmounting) {
                    this.forceUpdate();
                }
            });
        }
        buildPrintBands(fgEventSegs, tDateProfile, slotWidth) {
            const { options, dateEnv } = this.context;
            const fgSegs = this.sortSegs(fgEventSegs, options.eventOrder);
            const projectionSizing = resolveTimelineEventProjectionSizing(slotWidth, options.eventMinWidth);
            const plan = this.buildPlan(fgSegs, dateEnv, tDateProfile, projectionSizing.slotWidth, projectionSizing.eventMinWidth, options.eventOrderStrict);
            return this.printHeights.buildLayout(plan);
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
        }
    }

    const DEFAULT_TIME_FORMAT = protectedApi.createFormatter({
        hour: 'numeric',
        minute: '2-digit',
        omitZeroMinute: true,
        meridiem: 'narrow',
    });
    class TimelineEvent extends protectedApi.BaseComponent {
        render() {
            let { props } = this;
            return (jsxRuntime.jsx(protectedApi.StandardEvent, { ...props, display: 'row', defaultTimeFormat: DEFAULT_TIME_FORMAT, defaultDisplayEventTime: !props.isTimeScale }));
        }
    }

    class TimelineLaneMoreLink extends protectedApi.BaseComponent {
        render() {
            let { props } = this;
            let { hiddenSegs } = props;
            return (jsxRuntime.jsx(protectedApi.MoreLinkContainer, { display: 'row', allDayDate: null, segs: hiddenSegs, hiddenSegs: hiddenSegs, dateProfile: props.dateProfile, todayRange: props.todayRange, dateSpanProps: props.dateSpanProps, renderProps: props.renderProps, isNarrow: false, isMicro: false, popoverContent: () => (jsxRuntime.jsx(jsxRuntime.Fragment, { children: hiddenSegs.map((seg) => {
                        let { eventRange } = seg;
                        let { instanceId } = eventRange.instance;
                        let isDragging = Boolean(props.eventDrag && props.eventDrag.affectedInstances[instanceId]);
                        let isResizing = Boolean(props.eventResize && props.eventResize.affectedInstances[instanceId]);
                        let isInvisible = isDragging || isResizing;
                        return (jsxRuntime.jsx("div", { role: 'listitem', style: { visibility: isInvisible ? 'hidden' : undefined }, children: jsxRuntime.jsx(TimelineEvent, { isTimeScale: props.isTimeScale, eventRange: eventRange, isStart: seg.isStart, isEnd: seg.isEnd, isDragging: isDragging, isResizing: isResizing, isMirror: false, isSelected: instanceId === props.eventSelection, renderProps: props.renderProps, ...protectedApi.getEventRangeMeta(eventRange, props.todayRange, props.nowDate, props.nowMs) }) }, instanceId));
                    }) })) }));
        }
    }

    class TimelinePrintFg extends TimelinePrintRenderer {
        render() {
            const { props } = this;
            const { eventBands, moreLinkBand } = this.buildPrintBands(props.fgEventSegs, props.tDateProfile, props.slotWidth);
            return (jsxRuntime.jsxs("div", { className: classNames__default["default"].noShrink, children: [eventBands.map((band) => (jsxRuntime.jsx(TimelinePrintEventBand, { band: band, heightRefMap: this.printHeights.segHeightRefMap, dateProfile: props.dateProfile, tDateProfile: props.tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, eventSelection: props.eventSelection, dateSpanProps: props.dateSpanProps, renderProps: props.renderProps, timeCanvasClipStart: props.timeCanvasClipStart }, band.levelIndex))), moreLinkBand && (jsxRuntime.jsx(TimelinePrintMoreLinkBand, { band: moreLinkBand, heightRefMap: this.printHeights.moreLinkHeightRefMap, dateProfile: props.dateProfile, tDateProfile: props.tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, eventSelection: props.eventSelection, dateSpanProps: props.dateSpanProps, renderProps: props.renderProps, timeCanvasClipStart: props.timeCanvasClipStart }))] }));
        }
    }
    /** Renders one independently page-breakable Timeline print event band. */
    function TimelinePrintEventBand(props) {
        const { band } = props;
        return (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].crop, classNames__default["default"].breakInsideAvoid), style: { height: band.thickness }, children: band.slices.map((slice) => {
                const { sourceSeg } = slice;
                const seg = sourceSeg;
                const { eventRange } = seg;
                const { instanceId } = eventRange.instance;
                const isSelected = instanceId === props.eventSelection;
                return (jsxRuntime.jsx(protectedApi.MeasuredHeightHarness, { className: publicApi.joinClassNames(classNames__default["default"].abs, isSelected ? classNames__default["default"].z1000 : classNames__default["default"].z1), style: {
                        top: 0,
                        insetInlineStart: slice.start - (props.timeCanvasClipStart ?? 0),
                        width: slice.end - slice.start,
                    }, heightRef: props.heightRefMap.createRef(sourceSeg.key), children: jsxRuntime.jsx(TimelineEvent, { isTimeScale: props.tDateProfile.isTimeScale, eventRange: eventRange, isStart: slice.isStart, isEnd: slice.isEnd, isDragging: false, isResizing: false, isMirror: false, isSelected: isSelected, renderProps: props.renderProps, ...protectedApi.getEventRangeMeta(eventRange, props.todayRange, props.nowDate, props.nowMs) }) }, sourceSeg.key));
            }) }));
    }
    /** Renders Timeline's final independently page-breakable print more-link band. */
    function TimelinePrintMoreLinkBand(props) {
        const { band } = props;
        return (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].crop, classNames__default["default"].breakInsideAvoid), style: { height: band.thickness }, children: band.moreLinkGroups.map((group) => (jsxRuntime.jsx(protectedApi.MeasuredHeightHarness, { className: classNames__default["default"].abs, style: {
                    top: 0,
                    insetInlineStart: group.start - (props.timeCanvasClipStart ?? 0),
                    width: group.end - group.start,
                }, heightRef: props.heightRefMap.createRef(group.key), children: jsxRuntime.jsx(TimelineLaneMoreLink, { hiddenSegs: group.hiddenSlices.map((slice) => slice.sourceSeg), dateProfile: props.dateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, isTimeScale: props.tDateProfile.isTimeScale, eventDrag: null, eventResize: null, eventSelection: props.eventSelection, dateSpanProps: props.dateSpanProps, renderProps: props.renderProps }) }, group.key))) }));
    }

    class TimelineSlatCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // memo
            this.getDateMeta = protectedApi.memoize(protectedApi.getDateMeta);
            this.applyExactSlotMeta = protectedApi.memoize(applyExactSlotMeta);
        }
        render() {
            let { props, context } = this;
            let { dateEnv, options } = context;
            let { date, tDateProfile, isMajor } = props;
            let dateMeta = this.applyExactSlotMeta(this.getDateMeta(props.date, dateEnv, props.dateProfile, props.todayRange, props.nowDate), props.startMs, props.nowMs);
            let isMinor = tDateProfile.isTimeScale &&
                !protectedApi.isInt(dateEnv.countDurationsBetween(tDateProfile.normalizedRange.start, props.date, tDateProfile.labelInterval));
            let renderProps = {
                ...dateMeta,
                isMajor,
                isMinor,
                view: context.viewApi,
            };
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "div", className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noPadding, classNames__default["default"].alignStart, // shrinks width of InnerContent
                classNames__default["default"].borderlessY, classNames__default["default"].borderlessEnd, !props.borderStart && classNames__default["default"].borderlessStart, classNames__default["default"].internalTimelineSlot), attrs: {
                    'data-date': dateEnv.formatIso(date, {
                        omitTimeZoneOffset: true,
                        omitTime: !tDateProfile.isTimeScale,
                    }),
                    ...(dateMeta.isToday ? { 'aria-current': 'date' } : {}),
                }, style: {
                    width: props.width,
                }, renderProps: renderProps, generatorName: undefined, classNameGenerator: options.slotLaneClass, didMount: options.slotLaneDidMount, willUnmount: options.slotLaneWillUnmount }));
        }
    }

    class TimelineSlats extends protectedApi.BaseComponent {
        render() {
            let { props } = this;
            let { tDateProfile, slotWidth, slatStartIndex, slatCount } = props;
            const { timeAxis, slotDatesMajor } = tDateProfile;
            let slots = timeAxis?.slots ?? tDateProfile.slotDates.map((date, i) => ({
                date,
                key: tDateProfile.slotKeys[i],
                startMs: null,
            }));
            slatStartIndex = props.slatStartIndex || 0;
            if (slatStartIndex || slatCount !== undefined) {
                slots = slots.slice(slatStartIndex, slatStartIndex + slatCount);
            }
            return (jsxRuntime.jsx("div", { "aria-hidden": true, className: publicApi.joinClassNames(classNames__default["default"].flexRow, classNames__default["default"].fillY), style: {
                    height: props.height,
                    width: (props.slotWidth ?? 0) * slots.length,
                    insetInlineStart: -(props.clipStart ?? 0),
                }, children: slots.map((slot, i) => {
                    const slatIndex = slatStartIndex + i;
                    return (jsxRuntime.jsx(TimelineSlatCell, { date: slot.date, startMs: slot.startMs, dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, isMajor: slotDatesMajor[slatIndex], borderStart: Boolean(slatIndex), 
                        // dimensions
                        width: slotWidth }, slot.key));
                }) }));
        }
    }

    class TimelineLayoutPrint extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // refs
            this.headerElRef = compat.createRef();
        }
        render() {
            const { props, context } = this;
            const { options, viewSpec } = context;
            const { borderlessX, borderlessTop, borderlessBottom } = protectedApi.computeViewBorderless(options);
            const { tDateProfile, nowDate, todayRange, slicedProps } = props;
            const { cellRows } = tDateProfile;
            const tableDisplayInfo = {
                borderlessX,
                borderlessTop,
                borderlessBottom,
                multiMonthColumns: 0,
            };
            const headerDividerClassName = protectedApi.generateClassName(options.slotHeaderDividerClass, {
                inTableHeader: true,
                options: { dayMinWidth: options.dayMinWidth },
            });
            return (jsxRuntime.jsxs(protectedApi.ViewContainer, { viewSpec: viewSpec, className: publicApi.joinClassNames(props.className, classNames__default["default"].rel, classNames__default["default"].crop, classNames__default["default"].isolate), children: [jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].abs, classNames__default["default"].start0, classNames__default["default"].end0, classNames__default["default"].pointerEventsNone, classNames__default["default"].z0), style: {
                            top: this.state.headerHeight ?? 0,
                            // Compensates for Firefox miscomputing absolute height with repeated print headers.
                            bottom: '-5%',
                        }, children: [jsxRuntime.jsx(TimelineSlats, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, slotWidth: props.slotWidth, clipStart: props.timeCanvasClipStart }), jsxRuntime.jsx(TimelineBg, { tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, bgEventSegs: slicedProps.bgEventSegs, businessHourSegs: slicedProps.businessHourSegs, dateSelectionSegs: null, eventResizeSegs: null, slotWidth: props.slotWidth, clipStart: props.timeCanvasClipStart })] }), jsxRuntime.jsxs("table", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableClass, tableDisplayInfo), classNames__default["default"].printTable, classNames__default["default"].rel, classNames__default["default"].z1), children: [jsxRuntime.jsxs("thead", { ref: this.headerElRef, className: protectedApi.generateClassName(options.tableHeaderClass, {
                                    ...tableDisplayInfo,
                                    isSticky: false,
                                }), children: [jsxRuntime.jsx("tr", { children: jsxRuntime.jsx("th", { className: publicApi.joinClassNames(classNames__default["default"].noPadding, classNames__default["default"].borderless, classNames__default["default"].crop), children: jsxRuntime.jsx("div", { className: classNames__default["default"].rel, style: {
                                                    width: props.canvasWidth,
                                                    insetInlineStart: -props.timeCanvasClipStart,
                                                }, children: cellRows.map((cells, rowIndex) => {
                                                    const rowLevel = cellRows.length - rowIndex - 1;
                                                    return (jsxRuntime.jsx(TimelineHeaderRow, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, rowLevel: rowLevel, cells: cells, slotWidth: props.slotWidth }, rowLevel));
                                                }) }) }) }), jsxRuntime.jsx("tr", { children: jsxRuntime.jsx("th", { className: publicApi.joinClassNames(classNames__default["default"].noPadding, headerDividerClassName) }) })] }), jsxRuntime.jsx("tbody", { className: protectedApi.generateClassName(options.tableBodyClass, tableDisplayInfo), children: jsxRuntime.jsx("tr", { children: jsxRuntime.jsxs("td", { className: publicApi.joinClassNames(classNames__default["default"].noPadding, classNames__default["default"].borderless), children: [jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.timelineTopClass) }), jsxRuntime.jsx(TimelinePrintFg, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, fgEventSegs: slicedProps.fgEventSegs, eventSelection: slicedProps.eventSelection, slotWidth: props.slotWidth, timeCanvasClipStart: props.timeCanvasClipStart }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.timelineBottomClass) })] }) }) })] })] }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            this.disconnectHeaderHeight = protectedApi.watchHeight(this.headerElRef.current, (headerHeight) => {
                if (!this._isUnmounting && headerHeight !== this.state.headerHeight) {
                    this.setState({ headerHeight });
                }
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectHeaderHeight?.();
        }
    }

    class TimelineFg extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memo
            this.sortEventSegs = protectedApi.memoize(protectedApi.sortEventSegs);
            this.buildSegSources = protectedApi.memoize(buildTimelineSegSources);
            // refs
            this.sliceHeightRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleSegHeights);
            });
            this.moreLinkHeightRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleMoreLinkHeights);
            });
            this.handleMoreLinkHeights = () => {
                if (this._isUnmounting)
                    return;
                this.setState({ moreLinkHeightRev: this.moreLinkHeightRefMap.rev }); // will trigger rerender
            };
            this.handleSegHeights = () => {
                if (this._isUnmounting)
                    return;
                this.setState({ segHeightRev: this.sliceHeightRefMap.rev });
            };
        }
        render() {
            let { props, context, sliceHeightRefMap, moreLinkHeightRefMap } = this;
            let { options } = context;
            let { tDateProfile } = props;
            let mirrorSegs = (props.eventDrag ? props.eventDrag.segs : null) ||
                (props.eventResize ? props.eventResize.segs : null) ||
                [];
            let fgSegs = this.sortEventSegs(props.fgEventSegs, options.eventOrder);
            const projectionSizing = resolveTimelineEventProjectionSizing(props.slotWidth, options.eventMinWidth);
            let sourceSegs = this.buildSegSources(fgSegs, projectionSizing.eventMinWidth, context.dateEnv, tDateProfile, projectionSizing.slotWidth, props.clipStart, props.clipEnd);
            let placementResult = buildTimelineSegPlacements(sourceSegs, options.eventOrderStrict, options.eventMaxStack, sliceHeightRefMap.current, moreLinkHeightRefMap.current);
            this.totalHeight = placementResult.contentHeight;
            /*
            An assumed slot width may paint, but it may not report a height upward. It would be wrong
            until the width is measured. An empty lane waits for the width too, which stops it from
            latching 0 before its events arrive.
        
            With virtualization, sourceSegs are only those within the horizontal clip, and the height is
            reported from them. A resource row fits the events on screen, and shrinks after scrolling
            past a tall stack, unlike without virtualization.
            */
            this.totalHeightSettled = props.slotWidth != null &&
                placementResult.isSettled;
            const hasListItems = Boolean(placementResult.renderSlices.length || placementResult.moreLinks.length);
            return (jsxRuntime.jsxs("div", { ...(hasListItems ? { role: 'list', 'aria-label': props.label } : {}), className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].noShrink), style: {
                    height: placementResult.contentHeight,
                }, children: [this.renderEventSlices(placementResult.renderSlices, placementResult.sliceCoords), this.renderMirrorSegs(mirrorSegs, placementResult.sliceCoords), this.renderMoreLinks(placementResult.moreLinks)] }));
        }
        renderEventSlices(renderSlices, sliceCoords) {
            const { props } = this;
            return (jsxRuntime.jsx(jsxRuntime.Fragment, { children: renderSlices.map((slice) => {
                    const key = protectedApi.getSliceKey(slice);
                    const seg = slice.sourceSeg;
                    const top = sliceCoords.get(key);
                    const { eventRange } = seg;
                    const { instanceId } = eventRange.instance;
                    const isDragging = Boolean(props.eventDrag && props.eventDrag.affectedInstances[instanceId]);
                    const isResizing = Boolean(props.eventResize && props.eventResize.affectedInstances[instanceId]);
                    const isInvisible = isDragging || isResizing || top == null;
                    const isSelected = instanceId === props.eventSelection;
                    return (jsxRuntime.jsx(protectedApi.MeasuredHeightHarness, { attrs: { role: 'listitem' }, className: publicApi.joinClassNames(classNames__default["default"].abs, isSelected ? classNames__default["default"].z1000 : classNames__default["default"].z1), style: {
                            visibility: isInvisible ? 'hidden' : undefined,
                            top,
                            insetInlineStart: slice.start,
                            width: slice.end - slice.start,
                        }, heightRef: this.sliceHeightRefMap.createRef(key), children: jsxRuntime.jsx(TimelineEvent, { isTimeScale: props.tDateProfile.isTimeScale, eventRange: eventRange, isStart: seg.isStart, isEnd: seg.isEnd, isDragging: isDragging, isResizing: isResizing, isMirror: false, isSelected: isSelected, renderProps: props.renderProps, ...protectedApi.getEventRangeMeta(eventRange, props.todayRange, props.nowDate, props.nowMs) }) }, key));
                }) }));
        }
        // Mirrors bypass normal-event admission so limits cannot hide them or create more links.
        renderMirrorSegs(segs, fgSegTops) {
            const { props, context } = this;
            const projectionSizing = resolveTimelineEventProjectionSizing(props.slotWidth, context.options.eventMinWidth);
            return segs.map((seg) => {
                const { eventRange } = seg;
                const { instanceId } = eventRange.instance;
                const horizontal = computeSegHorizontals(seg, projectionSizing.eventMinWidth, context.dateEnv, props.tDateProfile, projectionSizing.slotWidth, props.clipStart, props.clipEnd);
                const isDragging = Boolean(props.eventDrag && props.eventDrag.affectedInstances[instanceId]);
                const isResizing = Boolean(props.eventResize && props.eventResize.affectedInstances[instanceId]);
                const isSelected = instanceId === props.eventSelection;
                return (jsxRuntime.jsx(protectedApi.MeasuredHeightHarness, { attrs: { 'aria-hidden': true }, className: publicApi.joinClassNames(classNames__default["default"].abs, isSelected ? classNames__default["default"].z1000 : classNames__default["default"].z1), style: {
                        top: fgSegTops.get(instanceId) ?? 0,
                        insetInlineStart: horizontal?.start,
                        width: horizontal && horizontal.end - horizontal.start,
                    }, children: jsxRuntime.jsx(TimelineEvent, { isTimeScale: props.tDateProfile.isTimeScale, eventRange: eventRange, isStart: seg.isStart, isEnd: seg.isEnd, isDragging: isDragging, isResizing: isResizing, isMirror: true, isSelected: isSelected, renderProps: props.renderProps, ...protectedApi.getEventRangeMeta(eventRange, props.todayRange, props.nowDate, props.nowMs) }) }, instanceId));
            });
        }
        renderMoreLinks(moreLinks) {
            const { props, moreLinkHeightRefMap } = this;
            return (jsxRuntime.jsx(jsxRuntime.Fragment, { children: moreLinks.map((moreLink) => (jsxRuntime.jsx(protectedApi.MeasuredHeightHarness, { attrs: { role: 'listitem' }, className: classNames__default["default"].abs, style: {
                        top: moreLink.top,
                        insetInlineStart: moreLink.start,
                        width: moreLink.end - moreLink.start,
                    }, heightRef: moreLinkHeightRefMap.createRef(moreLink.key), children: jsxRuntime.jsx(TimelineLaneMoreLink, { hiddenSegs: moreLink.segs, dateProfile: props.dateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, isTimeScale: props.tDateProfile.isTimeScale, eventDrag: props.eventDrag, eventResize: props.eventResize, eventSelection: props.eventSelection, dateSpanProps: props.dateSpanProps, renderProps: props.renderProps }) }, moreLink.key))) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            this.fireHeight(); // could be ready to fire if zero events and zero height
        }
        componentDidUpdate() {
            this.fireHeight();
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.firedTotalHeight = undefined;
            protectedApi.setRef(this.props.heightRef, null);
        }
        fireHeight() {
            if (this.totalHeightSettled &&
                this.totalHeight !== this.firedTotalHeight) {
                this.firedTotalHeight = this.totalHeight;
                protectedApi.setRef(this.props.heightRef, this.totalHeight);
            }
        }
    }

    /*
    TODO: DRY with other NowIndicator components
    */
    class TimelineNowIndicatorArrow extends protectedApi.BaseComponent {
        render() {
            const { props, context } = this;
            const nowDate = context.dateEnv.timestampToMarker(props.nowMs);
            const xStyle = props.slotWidth == null
                ? {}
                : {
                    insetInlineStart: props.tDateProfile.timeAxis
                        ? msToCoord(props.nowMs, props.tDateProfile, props.slotWidth)
                        : dateToCoord(nowDate, context.dateEnv, props.tDateProfile, props.slotWidth)
                };
            return (jsxRuntime.jsx("div", { 
                // crop any overflow that the arrow/line might cause
                // TODO: just do this on the entire canvas within the scroller
                className: publicApi.joinClassNames(classNames__default["default"].fill, classNames__default["default"].crop, classNames__default["default"].pointerEventsNone, classNames__default["default"].z2), children: jsxRuntime.jsx(protectedApi.NowIndicatorHeaderContainer, { className: classNames__default["default"].abs, style: xStyle, date: nowDate }) }));
        }
    }

    class TimelineNowIndicatorLine extends protectedApi.BaseComponent {
        render() {
            const { props, context } = this;
            const clipStart = props.clipStart ?? 0;
            const nowDate = context.dateEnv.timestampToMarker(props.nowMs);
            const xStyle = props.slotWidth == null
                ? {}
                : {
                    insetInlineStart: (props.tDateProfile.timeAxis
                        ? msToCoord(props.nowMs, props.tDateProfile, props.slotWidth)
                        : dateToCoord(nowDate, context.dateEnv, props.tDateProfile, props.slotWidth)) - clipStart
                };
            return (jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].fill, classNames__default["default"].pointerEventsNone, classNames__default["default"].z2), children: [jsxRuntime.jsx(protectedApi.NowIndicatorLineContainer, { className: publicApi.joinClassNames(classNames__default["default"].fillY, classNames__default["default"].noMarginY, classNames__default["default"].borderlessY), style: xStyle, date: nowDate }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].flexCol, // better for negative margins
                        classNames__default["default"].fillY), style: xStyle, children: jsxRuntime.jsx("div", { 
                            // stickiness on NowIndicatorDot misbehaves b/c of negative marginss
                            className: classNames__default["default"].stickyT, children: jsxRuntime.jsx(protectedApi.NowIndicatorDot, {}) }) })] }));
        }
    }

    function getTimelineSlotEl(parentEl, index) {
        return parentEl.querySelectorAll(`.${classNames__default["default"].internalTimelineSlot}`)[index];
    }

    class TimelineLayoutNormal extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // refs
            this.headerScrollerRef = compat.createRef();
            this.bodyScrollerRef = compat.createRef();
            this.footerScrollerRef = compat.createRef();
            this.headerRowInnerWidthMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleSlotInnerWidths);
            });
            this.scroll = {};
            this.handleSlotInnerWidths = () => {
                if (this._isUnmounting)
                    return;
                const headerSlotInnerWidth = this.headerRowInnerWidthMap.current.get(this.props.tDateProfile.cellRows.length - 1);
                if (headerSlotInnerWidth != null) {
                    protectedApi.setRef(this.props.slotInnerWidthRef, headerSlotInnerWidth);
                }
            };
            this.handleTotalWidth = (totalWidth) => {
                if (this._isUnmounting)
                    return;
                this.setState({ totalWidth });
            };
            this.handleTimeScrollRequest = (scrollTime) => {
                this.scroll.time = scrollTime;
                this.scroll.x = undefined;
                this.applyTimeScroll();
            };
            this.handleTimeScrollStart = (isDevice) => {
                if (isDevice) {
                    this.scroll.x = undefined;
                    this.scroll.time = undefined;
                }
            };
            this.handleTimeScrollEnd = (isDevice) => {
                if (isDevice) {
                    this.scroll.x = this.syncedScroller.x;
                    this.scroll.time = undefined;
                }
                protectedApi.setRef(this.props.scrollRef, this.scroll);
            };
            this.handleBodyEl = (el) => {
                this.bodyEl = el;
                if (el) {
                    this.context.registerInteractiveComponent(this, { el });
                }
                else {
                    this.context.unregisterInteractiveComponent(this);
                }
            };
        }
        render() {
            const { props, state, context } = this;
            const { options } = context;
            const { borderlessX, borderlessTop, borderlessBottom } = protectedApi.computeViewBorderless(options);
            const { tDateProfile, nowDate, todayRange, slicedProps, slotWidth, canvasWidth } = props;
            const { cellRows } = tDateProfile;
            const verticalScrolling = !protectedApi.getIsHeightAuto(options);
            const tableHeaderSticky = protectedApi.getTableHeaderSticky(options);
            const footerScrollbarSticky = protectedApi.getFooterScrollbarSticky(options);
            const endScrollbarWidth = (state.totalWidth != null && props.clientWidth != null)
                ? state.totalWidth - props.clientWidth
                : undefined;
            // When the canvas fits without scrolling, scrollTo() is a no-op that fires no scroll event,
            // so an uncapped time-based scroll would linger in scrollRef and print would clip the
            // leading slots (#8093)
            this.maxHScroll = (canvasWidth != null && props.clientWidth != null)
                ? Math.max(0, canvasWidth - props.clientWidth)
                : undefined;
            const enableNowIndicator = options.nowIndicator &&
                slotWidth != null &&
                isNowInTimelineRange(nowDate, props.dateProfile, tDateProfile);
            return (jsxRuntime.jsxs(protectedApi.ViewContainer, { viewSpec: context.viewSpec, className: publicApi.joinClassNames(classNames__default["default"].flexCol, props.className, protectedApi.generateClassName(options.tableClass, {
                    borderlessX,
                    borderlessTop,
                    borderlessBottom,
                    multiMonthColumns: 0,
                }), classNames__default["default"].isolate), children: [jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableHeaderClass, {
                            isSticky: tableHeaderSticky,
                            borderlessX,
                            borderlessTop,
                            borderlessBottom,
                            multiMonthColumns: 0,
                        }), classNames__default["default"].flexCol, tableHeaderSticky && classNames__default["default"].tableHeaderSticky, classNames__default["default"].z1), children: [jsxRuntime.jsxs(protectedApi.Scroller, { horizontal: true, hideScrollbars: true, className: classNames__default["default"].flexRow, ref: this.headerScrollerRef, children: [jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, canvasWidth == null && classNames__default["default"].liquid), style: { width: canvasWidth }, children: [cellRows.map((cells, rowIndex) => {
                                                const rowLevel = cellRows.length - rowIndex - 1;
                                                return (jsxRuntime.jsx(TimelineHeaderRow, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, rowLevel: rowLevel, cells: cells, slotWidth: slotWidth, innerWidthRef: this.headerRowInnerWidthMap.createRef(rowIndex) }, rowIndex));
                                            }), enableNowIndicator && (jsxRuntime.jsx(TimelineNowIndicatorArrow, { tDateProfile: tDateProfile, nowMs: props.nowMs, slotWidth: slotWidth }))] }), Boolean(endScrollbarWidth) && (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.fillerClass, { inTableHeader: true }), classNames__default["default"].borderlessY, classNames__default["default"].borderlessEnd), style: { minWidth: endScrollbarWidth } }))] }), jsxRuntime.jsx("div", { className: protectedApi.generateClassName(options.slotHeaderDividerClass, {
                                    inTableHeader: true,
                                    options: { dayMinWidth: options.dayMinWidth },
                                }) })] }), jsxRuntime.jsx(protectedApi.Scroller, { vertical: verticalScrolling, horizontal: true, hideScrollbars: footerScrollbarSticky, className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableBodyClass, {
                            borderlessX,
                            borderlessTop,
                            borderlessBottom,
                            multiMonthColumns: 0,
                        }), classNames__default["default"].flexCol, verticalScrolling && classNames__default["default"].liquid, classNames__default["default"].z0), ref: this.bodyScrollerRef, clientWidthRef: props.clientWidthRef, children: jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].grow), style: { width: canvasWidth }, ref: this.handleBodyEl, children: [jsxRuntime.jsx(TimelineSlats, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, slotWidth: slotWidth }), jsxRuntime.jsx(TimelineBg, { tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, bgEventSegs: slicedProps.bgEventSegs, businessHourSegs: slicedProps.businessHourSegs, dateSelectionSegs: slicedProps.dateSelectionSegs, eventResizeSegs: slicedProps.eventResize ? slicedProps.eventResize.segs : null, slotWidth: slotWidth }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.timelineTopClass) }), jsxRuntime.jsx(TimelineFg, { dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, fgEventSegs: slicedProps.fgEventSegs, eventDrag: slicedProps.eventDrag, eventResize: slicedProps.eventResize, eventSelection: slicedProps.eventSelection, label: options.eventsHint, slotWidth: slotWidth }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.timelineBottomClass) }), enableNowIndicator && (jsxRuntime.jsx(TimelineNowIndicatorLine, { tDateProfile: tDateProfile, nowMs: props.nowMs, slotWidth: slotWidth }))] }) }), Boolean(footerScrollbarSticky) && (jsxRuntime.jsx(protectedApi.FooterScrollbar, { isSticky: true, canvasWidth: canvasWidth, scrollerRef: this.footerScrollerRef })), jsxRuntime.jsx(protectedApi.Ruler, { widthRef: this.handleTotalWidth })] }));
        }
        componentDidMount() {
            const { props, context } = this;
            this._isUnmounting = false;
            this.syncedScroller = new ScrollerSyncer(true); // horizontal=true
            this.updateSyncedScroller();
            if (props.initialScroll) {
                this.scroll = { ...props.initialScroll };
                this.applyTimeScroll();
            }
            else {
                this.resetScroll();
            }
            context.emitter.on('_timeScrollRequest', this.handleTimeScrollRequest);
            this.syncedScroller.addScrollStartListener(this.handleTimeScrollStart);
            this.syncedScroller.addScrollEndListener(this.handleTimeScrollEnd);
        }
        componentDidUpdate(prevProps) {
            const { props } = this;
            const { options } = this.context;
            this.updateSyncedScroller();
            const dateProfileChange = prevProps.dateProfile !== props.dateProfile;
            const slotWidthChange = prevProps.slotWidth !== props.slotWidth;
            const clientWidthChange = prevProps.clientWidth !== props.clientWidth;
            if (dateProfileChange || slotWidthChange || clientWidthChange) {
                if (dateProfileChange && options.scrollTimeReset) {
                    this.resetScroll();
                }
                else {
                    this.applyTimeScroll();
                }
            }
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.syncedScroller.destroy();
            this.context.emitter.off('_timeScrollRequest', this.handleTimeScrollRequest);
            this.syncedScroller.removeScrollStartListener(this.handleTimeScrollStart);
            this.syncedScroller.removeScrollEndListener(this.handleTimeScrollEnd);
        }
        updateSyncedScroller() {
            this.syncedScroller.handleChildren([
                this.headerScrollerRef.current,
                this.bodyScrollerRef.current,
                this.footerScrollerRef.current,
            ]);
        }
        resetScroll() {
            this.handleTimeScrollRequest(this.context.options.scrollTime);
        }
        applyTimeScroll() {
            const x = this.computeTimeScroll();
            if (x != null) {
                this.syncedScroller.scrollTo({ x });
                if (this.scroll.x !== x) {
                    this.scroll.x = x;
                    protectedApi.setRef(this.props.scrollRef, this.scroll);
                }
            }
        }
        computeTimeScroll() {
            const { props, context, scroll } = this;
            let { x } = scroll;
            if (x == null && scroll.time != null && props.slotWidth != null) {
                x = timeToCoord(scroll.time, context.dateEnv, props.dateProfile, props.tDateProfile, props.slotWidth);
                if (x) {
                    x += 1; // overcome border. TODO: DRY this up
                }
            }
            if (x !== undefined && this.maxHScroll !== undefined) {
                x = Math.min(this.maxHScroll, x);
            }
            return x;
        }
        queryHit(isRtl, positionLeft, positionTop, elWidth, elHeight) {
            const { props, context } = this;
            if (props.slotWidth) {
                const hitData = computeTimelineHitData(positionLeft, elWidth, props.slotWidth, isRtl, props.tDateProfile, context.dateEnv);
                if (!hitData) {
                    return null;
                }
                return {
                    dateProfile: props.dateProfile,
                    dateSpan: hitData.dateSpan,
                    rect: {
                        ...hitData.rect,
                        top: 0,
                        bottom: elHeight,
                    },
                    getDayEl: () => getTimelineSlotEl(this.bodyEl, hitData.slatIndex),
                    layer: 0,
                };
            }
            return null;
        }
    }

    class TimelineView extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memoized
            this.buildTimelineDateProfile = protectedApi.memoize(buildTimelineDateProfile);
            this.computeSlotWidth = protectedApi.memoize(computeSlotWidth);
            // ref
            this.scrollRef = compat.createRef();
            this.slicer = new TimelineLaneSlicer();
            // Sizing
            // -----------------------------------------------------------------------------------------------
            this.handleSlotInnerWidth = (slotInnerWidth) => {
                if (this._isUnmounting)
                    return;
                if (slotInnerWidth != null && slotInnerWidth !== this.state.slotInnerWidth) {
                    this.setState({ slotInnerWidth });
                }
            };
            this.handleClientWidth = (clientWidth) => {
                if (this._isUnmounting)
                    return;
                if (clientWidth != null && clientWidth !== this.state.clientWidth) {
                    this.setState({ clientWidth });
                }
            };
        }
        render() {
            const { props, state, context } = this;
            const { options } = context;
            const { clientWidth } = state;
            /* date */
            const tDateProfile = this.buildTimelineDateProfile(props.dateProfile, context.dateEnv, options, context.dateProfileGenerator);
            let { unit: timerUnit, value: timerUnitValue } = protectedApi.greatestDurationDenominator(tDateProfile.slotDuration);
            /* table positions */
            const [canvasWidth, slotWidth] = this.computeSlotWidth(tDateProfile.slotCnt, tDateProfile.slotsPerLabel, options.slotMinWidth, state.slotInnerWidth, // is ACTUALLY the label width. rename?
            clientWidth);
            /* sliced */
            let slicedProps = this.slicer.sliceProps(props, props.dateProfile, tDateProfile.isTimeScale ? null : options.nextDayThreshold, context, // wish we didn't have to pass in the rest of the args...
            props.dateProfile, context.dateProfileGenerator, tDateProfile, context.dateEnv);
            return (jsxRuntime.jsx(protectedApi.NowTimer, { unit: timerUnit, unitValue: timerUnitValue, children: (nowDate, todayRange, nowMs) => {
                    const baseProps = {
                        className: props.className,
                        dateProfile: props.dateProfile,
                        tDateProfile,
                        nowDate,
                        nowMs,
                        todayRange,
                        slicedProps,
                        canvasWidth,
                        slotWidth,
                    };
                    return props.forPrint ? (jsxRuntime.jsx(TimelineLayoutPrint, { ...baseProps, timeCanvasClipStart: this.scrollRef.current?.x ?? 0 })) : (jsxRuntime.jsx(TimelineLayoutNormal, { ...baseProps, clientWidth: clientWidth, clientWidthRef: this.handleClientWidth, slotInnerWidthRef: this.handleSlotInnerWidth, initialScroll: this.scrollRef.current ?? undefined, scrollRef: this.scrollRef }));
                } }));
        }
        // Lifecycle
        // -----------------------------------------------------------------------------------------------
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
        }
    }

    var timelinePlugin = {
        name: 'timeline',
        premiumReleaseDate: '2026-11-12',
        deps: [premiumCommonPlugin],
        initialView: 'timelineDay',
        views: {
            timeline: {
                component: TimelineView,
                usesMinMaxTime: true,
                eventResizableFromStart: true, // how is this consumed for TimelineView tho?
            },
            timelineDay: {
                type: 'timeline',
                duration: { days: 1 },
            },
            timelineWeek: {
                type: 'timeline',
                duration: { weeks: 1 },
            },
            timelineMonth: {
                type: 'timeline',
                duration: { months: 1 },
            },
            timelineYear: {
                type: 'timeline',
                duration: { years: 1 },
            },
        },
    };

    class ResourceDayTimeColsJoiner extends VResourceJoiner {
        transformSeg(seg, resourceDayTable, resourceI) {
            let dateI = seg.col;
            let col = resourceDayTable.computeCol(dateI, resourceI);
            if (col === -1) {
                return [];
            }
            return [
                {
                    ...seg,
                    col,
                },
            ];
        }
    }

    class ResourceTimeGridView extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memo
            this.filterResourceStore = protectedApi.memoize(filterResourceStore);
            this.flattenResources = protectedApi.memoize(flattenResources);
            this.buildDaySeries = protectedApi.memoize((dateProfile, dateProfileGenerator) => (new protectedApi.DaySeriesModel(dateProfile.renderRange, dateProfileGenerator)));
            this.buildDayCols = protectedApi.memoize(protectedApi.buildDayColsFromSeries);
            this.extractDayRanges = protectedApi.memoize((dayCols) => dayCols.map((dayCol) => dayCol.range));
            this.computeHasEventsByDate = protectedApi.memoize(computeHasEventsByDate);
            this.buildResourceTableModel = protectedApi.memoize(buildResourceTableModel);
            this.buildResourceRowConfigs = protectedApi.memoize(buildResourceRowConfigs);
            this.buildBlankRenderProps = protectedApi.memoize(buildBlankDayLaneProps);
            this.createDayHeaderFormatter = protectedApi.memoize(protectedApi.createDayHeaderFormatter);
            // internal
            this.allDaySplitter = new protectedApi.AllDaySplitter();
            // for all-day-resource props
            this.allDayResourceSplitter = new VResourceSplitter();
            this.allDayResourceSlicers = {};
            this.allDayResourceJoiner = new ResourceDayTableJoiner();
            this.timedResourceSplitter = new VResourceSplitter();
            this.timedResourceSlicers = {};
            this.timedResourceJoiner = new ResourceDayTimeColsJoiner();
            // timed-only column splitting
            this.splitFgEventSegs = protectedApi.memoize(protectedApi.organizeSegsByCol);
            this.splitBgEventSegs = protectedApi.memoize(protectedApi.organizeSegsByCol);
            this.splitBusinessHourSegs = protectedApi.memoize(protectedApi.organizeSegsByCol);
            this.splitNowIndicatorSegs = protectedApi.memoize(protectedApi.organizeSegsByCol);
            this.splitDateSelectionSegs = protectedApi.memoize(protectedApi.organizeSegsByCol);
            this.splitEventDrag = protectedApi.memoize(protectedApi.splitInteractionByCol);
            this.splitEventResize = protectedApi.memoize(protectedApi.splitInteractionByCol);
            this.isHitComboAllowed = (hit0, hit1) => {
                let allowAcrossResources = this.dayRanges.length === 1;
                return this.resourceDayTableModel.isHitComboAllowed(hit0, hit1, allowAcrossResources);
            };
        }
        render() {
            let { props, context } = this;
            let { options, dateEnv } = context;
            let { dateProfile } = props;
            let resourceStore = this.filterResourceStore(props.resourceStore, options.filterResourcesWithEvents, props.rawEventStore, dateProfile.activeRange);
            let resourceOrderSpecs = options.resourceOrder || DEFAULT_RESOURCE_ORDER;
            let resources = this.flattenResources(resourceStore, resourceOrderSpecs);
            let daySeries = this.buildDaySeries(dateProfile, context.dateProfileGenerator);
            let dayCols = this.buildDayCols(daySeries, dateEnv, {
                slotRange: dateProfile,
                activeRange: dateProfile.activeRange,
            });
            let dayRanges = this.dayRanges = this.extractDayRanges(dayCols);
            // an event must intersect a column's rendered range to earn a column there
            let hasEventsByDate = options.filterResourcesWithEvents && dayCols.length > 1
                ? this.computeHasEventsByDate(props.rawEventStore, resourceStore, dayCols)
                : null;
            let resourceDayTableModel = this.resourceDayTableModel = this.buildResourceTableModel(null, dayCols, resources, options.datesAboveResources, hasEventsByDate, context);
            // split seg by all-day/timed
            let splitProps = this.allDaySplitter.splitProps(props);
            // split the all-day segs by resource
            let allDayResourceSplitProps = this.allDayResourceSplitter.splitProps({
                businessHours: splitProps.allDay.businessHours,
                dateSelection: splitProps.allDay.dateSelection,
                eventStore: splitProps.allDay.eventStore,
                eventUiBases: splitProps.allDay.eventUiBases,
                eventSelection: splitProps.allDay.eventSelection,
                eventDrag: splitProps.allDay.eventDrag,
                eventResize: splitProps.allDay.eventResize,
                resourceDayTableModel,
            });
            this.allDayResourceSlicers = protectedApi.mapHash(allDayResourceSplitProps, (split, resourceId) => this.allDayResourceSlicers[resourceId] || new protectedApi.DaySeriesSlicer());
            let allDayResourceSlicedProps = protectedApi.mapHash(this.allDayResourceSlicers, (slicer, resourceId) => slicer.sliceProps(allDayResourceSplitProps[resourceId], dateProfile, options.nextDayThreshold, context, daySeries));
            let allDayResourceJoinedProps = this.allDayResourceJoiner.joinProps(allDayResourceSlicedProps, resourceDayTableModel);
            // split the timed segs by resource
            let timedResourceSplitProps = this.timedResourceSplitter.splitProps({
                businessHours: splitProps.timed.businessHours,
                dateSelection: splitProps.timed.dateSelection,
                eventStore: splitProps.timed.eventStore,
                eventUiBases: splitProps.timed.eventUiBases,
                eventSelection: splitProps.timed.eventSelection, // result not used
                eventDrag: splitProps.timed.eventDrag,
                eventResize: splitProps.timed.eventResize,
                resourceDayTableModel,
            });
            this.timedResourceSlicers = protectedApi.mapHash(timedResourceSplitProps, (split, resourceId) => this.timedResourceSlicers[resourceId] || new protectedApi.DayTimeColsSlicer());
            let timedResourceSlicedProps = protectedApi.mapHash(this.timedResourceSlicers, (slicer, resourceId) => slicer.sliceProps(timedResourceSplitProps[resourceId], dateProfile, null, context, dayRanges));
            let timedResourceJoinedProps = this.timedResourceJoiner.joinProps(timedResourceSlicedProps, resourceDayTableModel);
            let datesRepDistinctDays = true;
            let dayHeaderFormat = this.createDayHeaderFormatter(context.options.dayHeaderFormat, datesRepDistinctDays, resourceDayTableModel.colCount);
            return (jsxRuntime.jsx(protectedApi.NowTimer, { unit: options.nowIndicator ? 'minute' : 'day' /* hacky */, children: (nowDate, todayRange, nowMs) => {
                    // timed-only column splitting
                    let colCount = resourceDayTableModel.colCount;
                    let fgEventSegsByCol = this.splitFgEventSegs(timedResourceJoinedProps.fgEventSegs, colCount);
                    let bgEventSegsByCol = this.splitBgEventSegs(timedResourceJoinedProps.bgEventSegs, colCount);
                    let businessHourSegsByCol = this.splitBusinessHourSegs(timedResourceJoinedProps.businessHourSegs, colCount);
                    let nowIndicatorSegsByCol = this.splitNowIndicatorSegs((() => {
                        // was buildNowIndicatorSegs
                        let nonResourceSegs = !props.forPrint && options.nowIndicator
                            ? this.timedResourceSlicers[''].sliceNowDate(nowDate, this.props.dateProfile, this.context.options.nextDayThreshold, this.context, this.dayRanges)
                            : []; // TODO: breaks memoization?
                        const expandedSegs = this.timedResourceJoiner.expandSegs(resourceDayTableModel, nonResourceSegs);
                        const dayCnt = dayCols.length;
                        return expandedSegs.map((seg) => ({
                            ...seg,
                            showDot: !options.datesAboveResources && dayCnt > 1
                                ? true
                                : resourceDayTableModel.dateFirstCols[resourceDayTableModel.cols[seg.col].dateI] === seg.col,
                        }));
                    })(), colCount);
                    let dateSelectionSegsByCol = this.splitDateSelectionSegs(timedResourceJoinedProps.dateSelectionSegs, colCount);
                    let eventDragByCol = this.splitEventDrag(timedResourceJoinedProps.eventDrag, colCount);
                    let eventResizeByCol = this.splitEventResize(timedResourceJoinedProps.eventResize, colCount);
                    const headerTiers = this.buildResourceRowConfigs(resourceDayTableModel, datesRepDistinctDays, props.dateProfile, todayRange, dayHeaderFormat, context, options.dayLaneClass, this.buildBlankRenderProps(protectedApi.computeTimeGridPrintMode(props.forPrint, options.eventPrintLayout) === 'stack'));
                    return (jsxRuntime.jsx(protectedApi.TimeGridLayout, { labelId: props.labelId, labelStr: props.labelStr, dateProfile: dateProfile, nowDate: nowDate, nowMs: nowMs, todayRange: todayRange, cells: resourceDayTableModel.cols, forPrint: props.forPrint, isHitComboAllowed: this.isHitComboAllowed, className: props.className, 
                        // header content
                        headerTiers: headerTiers, 
                        // all-day content
                        fgEventSegs: allDayResourceJoinedProps.fgEventSegs, bgEventSegs: allDayResourceJoinedProps.bgEventSegs, businessHourSegs: allDayResourceJoinedProps.businessHourSegs, dateSelectionSegs: allDayResourceJoinedProps.dateSelectionSegs, eventDrag: allDayResourceJoinedProps.eventDrag, eventResize: allDayResourceJoinedProps.eventResize, 
                        // timed content
                        fgEventSegsByCol: fgEventSegsByCol, bgEventSegsByCol: bgEventSegsByCol, businessHourSegsByCol: businessHourSegsByCol, nowIndicatorSegsByCol: nowIndicatorSegsByCol, dateSelectionSegsByCol: dateSelectionSegsByCol, eventDragByCol: eventDragByCol, eventResizeByCol: eventResizeByCol, 
                        // universal content
                        eventSelection: allDayResourceJoinedProps.eventSelection || splitProps.timed.eventSelection }));
                } }));
        }
    }
    // Extra DayLaneInfo props for the blank header's dayLaneClass hook.
    // buildResourceRowConfigs supplies the shared date props.
    function buildBlankDayLaneProps(isStack) {
        return { isStack };
    }

    var resourceTimeGridPlugin = {
        name: 'resource-timegrid',
        premiumReleaseDate: '2026-11-12',
        deps: [
            premiumCommonPlugin,
            timeGridPlugin__default["default"],
            resourcePlugin,
            resourceDayGridPlugin,
        ],
        initialView: 'resourceTimeGridDay',
        views: {
            resourceTimeGrid: {
                type: 'timeGrid', // will inherit this configuration
                component: ResourceTimeGridView,
                needsResourceData: true,
            },
            resourceTimeGridDay: {
                type: 'resourceTimeGrid',
                duration: { days: 1 },
            },
            resourceTimeGridWeek: {
                type: 'resourceTimeGrid',
                duration: { weeks: 1 },
            },
        },
    };

    function fracToCssDim(frac) {
        return frac * 100 + '%';
    }

    function parseDimConfig(input, minDim = 0) {
        if (input != null) {
            if (typeof input === 'string') {
                let m = input.match(/^(.*)(%|px)$/);
                if (m) {
                    const num = parseFloat(m[1]);
                    if (!isNaN(num)) {
                        if (m[2] === '%') {
                            return { pixels: 0, frac: num / 100, min: minDim };
                        }
                        else {
                            return { pixels: num, frac: 0, min: minDim };
                        }
                    }
                }
            }
            else if (typeof input === 'number' && !isNaN(input)) {
                return { pixels: input, frac: 0, min: minDim };
            }
        }
    }
    /*
    A sibling without a parsed width grows to fill the space
    */
    function toSiblingDimConfig(dimConfig, grow, minDim) {
        return dimConfig
            ? { ...dimConfig, grow: grow || 0 }
            : { pixels: 0, frac: 0, grow: grow || 1, min: minDim };
    }
    /*
    Ensure at least one column can grow
    Mutates in-place
    */
    function ensureDimConfigsGrow(dimConfigs) {
        for (const dimConfig of dimConfigs) {
            if (dimConfig.grow) {
                return;
            }
        }
        // make all expand equally
        for (const dimConfig of dimConfigs) {
            dimConfig.grow = 1;
        }
    }
    function pixelizeDimConfigs(dimConfigs, clientDim) {
        const pixelDims = [];
        let preGrowTotal = 0;
        let growDenom = 0;
        for (const dimConfig of dimConfigs) {
            const constrainedPixels = Math.max(dimConfig.pixels + (dimConfig.frac * clientDim), dimConfig.min);
            pixelDims.push(constrainedPixels);
            preGrowTotal += constrainedPixels;
            growDenom += dimConfig.grow;
        }
        if (preGrowTotal < clientDim) {
            const remainder = clientDim - preGrowTotal;
            for (let i = 0; i < dimConfigs.length; i++) {
                pixelDims[i] += remainder * (dimConfigs[i].grow / growDenom);
            }
        }
        return [pixelDims, preGrowTotal];
    }
    function serializeDimConfig({ pixels, frac }) {
        if (!frac) {
            return pixels;
        }
        if (!pixels) {
            return fracToCssDim(frac);
        }
        return `calc(${fracToCssDim(frac)} + ${pixels}px)`;
    }
    function resizeSiblingDimConfig(dimConfigs, pixelDims, clientDim, resizeIndex, resizeDim) {
        const newDimConfigs = [];
        for (let i = 0; i < resizeIndex; i++) {
            newDimConfigs.push(resizeDimConfig(dimConfigs[i], pixelDims[i], clientDim));
        }
        newDimConfigs.push(resizeDimConfig(dimConfigs[resizeIndex], resizeDim, clientDim));
        const len = dimConfigs.length;
        let anyGrow = false;
        for (let i = resizeIndex + 1; i < len; i++) {
            const dimConfig = dimConfigs[i];
            newDimConfigs.push(dimConfig);
            if (dimConfig.grow) {
                anyGrow = true;
            }
        }
        if (!anyGrow) {
            for (let i = resizeIndex + 1; i < len; i++) {
                newDimConfigs[i] = Object.assign({}, newDimConfigs[i], { grow: 1 });
            }
        }
        return newDimConfigs;
    }
    function resizeDimConfig(dimConfig, newPixels, clientDim) {
        const { min } = dimConfig;
        newPixels = Math.max(min, newPixels);
        if (dimConfig.pixels) {
            return { pixels: newPixels, frac: 0, grow: 0, min };
        }
        return { pixels: 0, frac: newPixels / clientDim, grow: 0, min };
    }

    const ROW_BORDER_WIDTH = 1;
    // Resource/Group Verticals
    // -------------------------------------------------------------------------------------------------
    function computeHeights(siblingNodes, getEntityKey, getEntityHeight, minHeight) {
        const heightMap = new Map();
        let [totalHeight, expandableCount] = computeTightHeights(siblingNodes, getEntityKey, getEntityHeight, heightMap);
        if (minHeight != null && minHeight > totalHeight) {
            expandHeights(siblingNodes, getEntityKey, heightMap, (minHeight - totalHeight) / expandableCount);
            totalHeight = minHeight;
        }
        return [heightMap, totalHeight];
    }
    function computeTightHeights(siblingNodes, getEntityKey, getEntityHeight, heightMap) {
        let totalHeight = 0;
        let expandableCount = 0;
        for (const siblingNode of siblingNodes) {
            const entityKey = getEntityKey(siblingNode.entity);
            let ownHeight = getEntityHeight(entityKey) || 0;
            const [childrenHeight, childrenExpandableCount] = computeTightHeights(siblingNode.children, getEntityKey, getEntityHeight, heightMap);
            if (siblingNode.pooledHeight) { // 'own' is side-by-side with children
                if (ownHeight > childrenHeight) {
                    // children are smaller. grow them
                    expandHeights(siblingNode.children, getEntityKey, heightMap, (ownHeight - childrenHeight) / childrenExpandableCount);
                }
                else {
                    // own-element is smaller. grow to height of children
                    ownHeight = childrenHeight;
                }
                totalHeight += ownHeight;
            }
            else { // 'own' is above children
                totalHeight += ownHeight;
                if (siblingNode.children.length) {
                    totalHeight += ROW_BORDER_WIDTH + childrenHeight;
                }
            }
            heightMap.set(entityKey, ownHeight);
            // expandable?
            // vertically stacked, and not a group
            if (siblingNode.pooledHeight === undefined) {
                expandableCount++;
            }
            expandableCount += childrenExpandableCount;
        }
        // borders between siblings
        if (siblingNodes.length) {
            totalHeight += ROW_BORDER_WIDTH * (siblingNodes.length - 1);
        }
        return [totalHeight, expandableCount];
    }
    function expandHeights(siblingNodes, getEntityKey, heightMap, expansion) {
        for (const siblingNode of siblingNodes) {
            // expandable?
            // vertically stacked, and not a group
            if (siblingNode.pooledHeight === undefined) {
                const entityKey = getEntityKey(siblingNode.entity);
                heightMap.set(entityKey, heightMap.get(entityKey) + expansion);
            }
            expandHeights(siblingNode.children, getEntityKey, heightMap, expansion);
        }
    }
    function computeTopsFromHeights(siblingNodes, getEntityKey, heightMap, initialTop = 0) {
        const topMap = new Map();
        computeTopsStartingAt(siblingNodes, getEntityKey, heightMap, topMap, initialTop);
        return topMap;
    }
    function computeTopsStartingAt(siblingNodes, getEntityKey, heightMap, topMap, top) {
        for (let i = 0; i < siblingNodes.length; i++) {
            const siblingNode = siblingNodes[i];
            const entityKey = getEntityKey(siblingNode.entity);
            topMap.set(entityKey, top);
            if (!siblingNode.pooledHeight) {
                top += heightMap.get(entityKey) + ROW_BORDER_WIDTH;
            }
            top = computeTopsStartingAt(siblingNode.children, getEntityKey, heightMap, topMap, top);
        }
        return top;
    }
    function findEntityByCoord(siblingNodes, entityTops, // keyed by createEntityId
    entityHeights, // keyed by createEntityId
    coord, // assumed >= 0
    createEntityId) {
        for (const siblingNode of siblingNodes) {
            const entityKey = createEntityId(siblingNode.entity);
            const siblingOwnTop = entityTops.get(entityKey);
            const siblingOwnHeight = entityHeights.get(entityKey);
            // intersection of the sibling's own element?
            if (siblingOwnTop + siblingOwnHeight > coord) {
                if (siblingNode.pooledHeight) {
                    // need more specific result
                    return findEntityByCoord(siblingNode.children, entityTops, entityHeights, coord, createEntityId);
                }
                else {
                    return [siblingNode.entity, siblingOwnTop, siblingOwnHeight];
                }
            }
            else if (!siblingNode.pooledHeight) {
                // search siblings below
                const childrenRes = findEntityByCoord(siblingNode.children, entityTops, entityHeights, coord, createEntityId);
                if (childrenRes) {
                    return childrenRes;
                }
            }
        }
    }

    /*
    A "layout" wraps the resource/group entity with presentation information (indent, isExpanded, etc)
    Creates a layout hierarchy (`layouts`) and flattened projections for each row type and all rows.
    Filters away not-expanded nodes.

    TODO: even when a row is collapsed, consistent global rowIndex
    */
    function buildResourceLayouts(hierarchy, hasNesting, expansions, expansionDefault) {
        const flatResourceRowLayouts = [];
        const flatGroupRowLayouts = [];
        const flatGroupColLayouts = [];
        const flatRowLayouts = [];
        function processNodes(nodes, startingIndex, startingVisibleIndex, depth, rowDepth, indent, isVisible) {
            const layouts = [];
            let totalCnt = 0; // visible or not
            let visibleCnt = 0;
            // TODO: more DRY within
            for (const node of nodes) {
                // ResourceRow
                if (node.resourceFields) {
                    const isExpanded = expansions[node.entity.id] ?? expansionDefault;
                    const rowIndex = startingIndex + totalCnt++;
                    const visibleIndex = startingVisibleIndex + visibleCnt++;
                    const resourceLayout = {
                        rowIndex,
                        visibleIndex,
                        entity: node.entity,
                        resourceFields: node.resourceFields,
                        isExpanded,
                        hasChildren: Boolean(node.children.length),
                        depth,
                        rowDepth,
                        indent,
                        children: [],
                    };
                    if (isVisible) {
                        flatRowLayouts.push(resourceLayout);
                        flatResourceRowLayouts.push(resourceLayout);
                        layouts.push(resourceLayout);
                    }
                    const [localChildren, subtreeTotalCnt, subtreeVisibleCnt] = processNodes(node.children, startingIndex + totalCnt, startingVisibleIndex + visibleCnt, depth + 1, rowDepth + 1, indent + 1, isVisible && isExpanded);
                    if (isVisible && isExpanded) {
                        resourceLayout.children = localChildren;
                        visibleCnt += subtreeVisibleCnt;
                    }
                    totalCnt += subtreeTotalCnt;
                    // GroupCell
                }
                else if (node.pooledHeight) {
                    const rowIndex = startingIndex + totalCnt; // DON'T advance
                    const visibleIndex = startingVisibleIndex + visibleCnt; // DON'T advance
                    const groupCellLayout = {
                        rowIndex,
                        visibleIndex,
                        rowSpan: 0, // populated very soon...
                        entity: node.entity,
                        pooledHeight: true,
                        children: [], // populates very soon...
                    };
                    if (isVisible) {
                        (flatGroupColLayouts[depth] || (flatGroupColLayouts[depth] = []))
                            .push(groupCellLayout);
                        layouts.push(groupCellLayout);
                    }
                    const [localChildren, subtreeTotalCnt, subtreeVisibleCnt] = processNodes(node.children, startingIndex + totalCnt, startingVisibleIndex + visibleCnt, depth + 1, rowDepth, // do NOT advance
                    indent, isVisible);
                    if (isVisible) {
                        groupCellLayout.children = localChildren;
                        groupCellLayout.rowSpan = subtreeTotalCnt;
                        visibleCnt += subtreeVisibleCnt;
                    }
                    totalCnt += subtreeTotalCnt;
                    // GroupRow
                }
                else {
                    const isExpanded = expansions[createGroupId(node.entity)] ?? expansionDefault;
                    const rowIndex = startingIndex + totalCnt++;
                    const visibleIndex = startingVisibleIndex + visibleCnt++;
                    const groupRowLayout = {
                        rowIndex,
                        visibleIndex,
                        entity: node.entity,
                        pooledHeight: false,
                        isExpanded,
                        hasChildren: Boolean(node.children.length),
                        depth,
                        rowDepth,
                        indent,
                        children: [], // populates very soon...
                    };
                    if (isVisible) {
                        flatRowLayouts.push(groupRowLayout);
                        flatGroupRowLayouts.push(groupRowLayout);
                        layouts.push(groupRowLayout);
                    }
                    const [localChildren, subtreeTotalCnt, subtreeVisibleCnt] = processNodes(node.children, startingIndex + totalCnt, startingVisibleIndex + visibleCnt, depth + 1, rowDepth + 1, indent + 1, isVisible && isExpanded);
                    if (isVisible && isExpanded) {
                        groupRowLayout.children = localChildren;
                        visibleCnt += subtreeVisibleCnt;
                    }
                    totalCnt += subtreeTotalCnt;
                }
            }
            return [layouts, totalCnt, visibleCnt];
        }
        const [layouts, totalCnt] = processNodes(hierarchy, 0, 0, 0, 0, hasNesting ? 1 : 0, true);
        return {
            layouts,
            flatRowLayouts,
            flatResourceRowLayouts,
            flatGroupRowLayouts,
            flatGroupColLayouts,
            totalCnt,
        };
    }

    function buildAriaCellId(prefix, rowIndex, colIndex) {
        return `${prefix}-${rowIndex}-${colIndex}`;
    }
    // Without nesting, a table: there's no roving tabindex, and a grid makes JAWS switch to forms mode
    // (arrow keys passed to the page, which ignores them) when focus lands on an event.
    // With nesting, still a treegrid, the only role that conveys the hierarchy (aria-level/aria-expanded),
    // until roving tabindex is implemented
    function getAriaTableRole(hasNesting) {
        return hasNesting ? 'treegrid' : 'table';
    }
    function getAriaCellRole(props) {
        return props.inTreeGrid ? 'gridcell' : 'cell';
    }
    // Derives the cell's DOM id (referenced by proxy-row aria-owns) and aria-colindex from the same
    // (prefix, rowIndex, colIndex) source, so the id and column attributes can never disagree.
    function buildAriaCellAttrs(props) {
        return {
            id: (props.cellIdPrefix && props.cellRowIndex != null && props.cellColIndex != null)
                ? buildAriaCellId(props.cellIdPrefix, props.cellRowIndex, props.cellColIndex)
                : undefined,
            'aria-colindex': props.cellColIndex != null ? 1 + props.cellColIndex : undefined,
        };
    }
    // Renders visually hidden proxy rows that own cells split across the spreadsheet and timeline panes.
    // The grid declares aria-colcount and every owned cell declares aria-colindex. Inference from the
    // owned-cell order alone would misnumber rows covered by a vertically spanning group-column cell:
    // only the first covered row owns the spanning cell, so later covered rows' first owned cell would
    // be inferred as column 1 unless the AT applies aria-rowspan across proxy rows (unreliable).
    function AriaProxyRows(props) {
        const { cellIdPrefix, bodyRows, resourceColCnt, superHeaderRowSpan, hasNesting, } = props;
        const totalHeaderRowSpan = 1 + superHeaderRowSpan;
        const resourceHeaderCellIds = Array.from({ length: resourceColCnt }, (_value, colIndex) => {
            return buildAriaCellId(cellIdPrefix, 1 + superHeaderRowSpan, colIndex);
        });
        const timelineHeaderCellId = buildAriaCellId(cellIdPrefix, 1, resourceColCnt);
        return (jsxRuntime.jsxs("div", { role: 'presentation', style: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' }, children: [jsxRuntime.jsx("div", { role: 'row', "aria-rowindex": 1, "aria-owns": superHeaderRowSpan
                        ? `${buildAriaCellId(cellIdPrefix, 1, 0)} ${timelineHeaderCellId}`
                        : [...resourceHeaderCellIds, timelineHeaderCellId].join(' ') }), Boolean(superHeaderRowSpan) && (jsxRuntime.jsx("div", { role: 'row', "aria-rowindex": 2, "aria-owns": resourceHeaderCellIds.join(' ') })), bodyRows.map((ariaRow) => {
                    const rowLayout = ariaRow.layout;
                    const rowIndex = 1 + totalHeaderRowSpan + rowLayout.rowIndex;
                    return (jsxRuntime.jsx("div", { role: 'row', "aria-rowindex": rowIndex, "aria-level": hasNesting ? 1 + rowLayout.rowDepth : undefined, "aria-expanded": isEntityGroup(rowLayout.entity) || rowLayout.hasChildren
                            ? rowLayout.isExpanded
                            : undefined, "aria-owns": Array.from(ariaRow.colIndices)
                            .sort((colIndex0, colIndex1) => colIndex0 - colIndex1)
                            .map((colIndex) => buildAriaCellId(cellIdPrefix, rowIndex, colIndex))
                            .join(' ') }, rowIndex));
                })] }));
    }
    // Builds proxy body-row ownership from the independently virtualized cell sources.
    // Only mounted cells are included, and cells from different panes accumulate on the same logical row.
    function buildAriaBodyRows(flatRowLayouts, groupColPositions, rowPositions, groupColCnt, resourceColCnt) {
        const ariaBodyRowMap = new Map();
        // Merge a mounted cell into its logical owner row while avoiding duplicate column references.
        const addCell = (rowLayout, colIndex) => {
            let ariaRow = ariaBodyRowMap.get(rowLayout.visibleIndex);
            if (!ariaRow) {
                ariaRow = {
                    layout: rowLayout,
                    colIndices: new Set(),
                };
                ariaBodyRowMap.set(rowLayout.visibleIndex, ariaRow);
            }
            ariaRow.colIndices.add(colIndex);
        };
        // A vertically spanning group-column cell belongs to the first logical row it covers,
        // mirroring HTML rowspan, where the spanned cell is a child of the first covered <tr>.
        // Because the cell and the rows are virtualized independently, the owner row might be outside
        // rowPositions while the spanning cell itself intersects the viewport (the cell covers later,
        // mounted rows). We still emit a proxy row for that unmounted owner — it will own only the
        // group cell, lacking the resource's naming rowheader and lane — because the alternative is
        // worse: a mounted cell owned by no row surfaces as a stray direct child of the grid,
        // breaking the table structure for assistive technology.
        for (let colIndex = 0; colIndex < groupColPositions.length; colIndex += 1) {
            for (const groupCellPosition of groupColPositions[colIndex]) {
                addCell(flatRowLayouts[groupCellPosition.item.visibleIndex], colIndex);
            }
        }
        // Add cells rendered once per mounted logical row. Group rows have one spreadsheet cell spanning
        // the resource columns; resource rows have one cell per non-group spreadsheet column.
        for (const rowPosition of rowPositions) {
            const rowLayout = rowPosition.item;
            if (isEntityGroup(rowLayout.entity)) {
                addCell(rowLayout, 0);
            }
            else {
                for (let colIndex = groupColCnt; colIndex < resourceColCnt; colIndex += 1) {
                    addCell(rowLayout, colIndex);
                }
            }
            // The timeline lane is the final column for both group and resource rows.
            addCell(rowLayout, resourceColCnt);
        }
        // Collection begins with column-group cells, so map insertion order is not necessarily visual order.
        // Proxy-row DOM order must match the visual vertical order.
        return Array.from(ariaBodyRowMap.values()).sort((row0, row1) => {
            return row0.layout.visibleIndex - row1.layout.visibleIndex;
        });
    }

    /*
    parallels the ResourceGroupHeaderCell
    */
    class GroupLane extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // ref
            this.innerElRef = compat.createRef();
        }
        render() {
            let { props, context } = this;
            let { group, forPrint } = props;
            let groupSpec = group.spec; // type HACK
            let renderProps = {
                fieldValue: group.value,
                view: context.viewApi,
            };
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'td' : 'div', attrs: {
                    ...buildAriaCellAttrs(props),
                    role: getAriaCellRole(props),
                }, className: publicApi.joinClassNames(!forPrint && classNames__default["default"].liquid, // expand to whole row
                classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].contentBox, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.borderBottom && classNames__default["default"].borderlessBottom), style: forPrint ? undefined : {
                    height: props.height,
                }, renderProps: renderProps, generatorName: "resourceGroupLaneContent", customGenerator: groupSpec.laneContent, classNameGenerator: groupSpec.laneClass, didMount: groupSpec.laneDidMount, willUnmount: groupSpec.laneWillUnmount, children: (InnerContainer) => (jsxRuntime.jsx(InnerContainer, { tag: "div", elRef: this.innerElRef, className: publicApi.joinClassNames(protectedApi.generateClassName(groupSpec.laneInnerClass, renderProps), classNames__default["default"].noShrink, classNames__default["default"].noMargin) })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            const innerEl = this.innerElRef.current;
            this.disconnectInnerHeight = protectedApi.watchHeight(innerEl, (height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectInnerHeight();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }

    class ResourceLane extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // memo
            this.refineRenderProps = protectedApi.memoizeObjArg(refineResourceLaneRenderProps);
            this.buildDateSpanProps = protectedApi.memoize(buildResourceDateSpanProps);
            this.buildEventRenderProps = protectedApi.memoize(buildResourceEventRenderProps);
            this.slicer = new TimelineLaneSlicer();
            this.handleEventsHeight = (eventsHeight) => {
                if (this._isUnmounting)
                    return;
                this.eventsHeight = eventsHeight;
                protectedApi.afterSize(this.handleHeight);
            };
            this.handleTopEl = (topEl) => {
                if (this.disconnectTopHeight) {
                    this.disconnectTopHeight();
                    this.disconnectTopHeight = undefined;
                }
                if (topEl) {
                    this.disconnectTopHeight = protectedApi.watchHeight(topEl, (topHeight) => {
                        if (this._isUnmounting)
                            return;
                        this.topHeight = topHeight;
                        protectedApi.afterSize(this.handleHeight);
                    });
                }
            };
            this.handleBottomEl = (footerEl) => {
                if (this.disconnectBottomHeight) {
                    this.disconnectBottomHeight();
                    this.disconnectBottomHeight = undefined;
                }
                if (footerEl) {
                    this.disconnectBottomHeight = protectedApi.watchHeight(footerEl, (bottomHeight) => {
                        if (this._isUnmounting)
                            return;
                        this.bottomHeight = bottomHeight;
                        protectedApi.afterSize(this.handleHeight);
                    });
                }
            };
            this.handleHeight = () => {
                if (this._isUnmounting)
                    return;
                const { topHeight, bottomHeight, eventsHeight } = this;
                if (topHeight != null && bottomHeight != null && eventsHeight != null) {
                    protectedApi.setRef(this.props.heightRef, topHeight + bottomHeight + eventsHeight);
                }
            };
        }
        render() {
            let { props, context } = this;
            let { resource } = props;
            let { options } = context;
            let renderProps = this.refineRenderProps({
                resource,
                context,
                eventOverlap: Boolean(options.eventOverlap),
            });
            let eventRenderProps = this.buildEventRenderProps(renderProps.resource);
            /* sliced */
            let slicedProps = this.slicer.sliceProps(props, props.dateProfile, props.tDateProfile.isTimeScale ? null : options.nextDayThreshold, context, // wish we didn't have to pass in the rest of the args...
            props.dateProfile, context.dateProfileGenerator, props.tDateProfile, context.dateEnv);
            return (jsxRuntime.jsx("div", { role: props.role, className: publicApi.joinClassNames(props.className, // probably contains fillX
                classNames__default["default"].flexRow), style: {
                    top: props.top,
                    width: props.width,
                    insetInlineStart: props.insetInlineStart ?? props.clipStart,
                }, children: jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "div", attrs: {
                        ...buildAriaCellAttrs(props),
                        role: getAriaCellRole(props),
                        'data-resource-id': resource.id,
                    }, className: publicApi.joinClassNames(classNames__default["default"].liquid, classNames__default["default"].noMargin, classNames__default["default"].noPadding, classNames__default["default"].flexCol, classNames__default["default"].contentBox, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.borderBottom && classNames__default["default"].borderlessBottom, classNames__default["default"].rel), style: {
                        height: props.height,
                    }, renderProps: renderProps, generatorName: undefined, classNameGenerator: options.resourceLaneClass, didMount: options.resourceLaneDidMount, willUnmount: options.resourceLaneWillUnmount, children: () => (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(TimelineBg, { tDateProfile: props.tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, 
                                // content
                                bgEventSegs: slicedProps.bgEventSegs, businessHourSegs: slicedProps.businessHourSegs, dateSelectionSegs: slicedProps.dateSelectionSegs, eventResizeSegs: slicedProps.eventResize ? slicedProps.eventResize.segs : null, renderProps: eventRenderProps, 
                                // dimensions
                                slotWidth: props.slotWidth, 
                                // virtualization
                                clipStart: props.clipStart, clipEnd: props.clipEnd }), jsxRuntime.jsx(protectedApi.ContentContainer, { tag: 'div', elRef: this.handleTopEl, className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noShrink), renderProps: renderProps, generatorName: 'resourceLaneTopContent', customGenerator: options.resourceLaneTopContent, classNameGenerator: options.resourceLaneTopClass }), jsxRuntime.jsx(TimelineFg, { dateProfile: props.dateProfile, tDateProfile: props.tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, 
                                // content
                                fgEventSegs: slicedProps.fgEventSegs, eventDrag: slicedProps.eventDrag, eventResize: slicedProps.eventResize, eventSelection: slicedProps.eventSelection, dateSpanProps: this.buildDateSpanProps(resource.id), renderProps: eventRenderProps, 
                                // dimensions
                                slotWidth: props.slotWidth, 
                                // virtualization
                                clipStart: props.clipStart, clipEnd: props.clipEnd, 
                                // ref
                                heightRef: this.handleEventsHeight }), jsxRuntime.jsx(protectedApi.ContentContainer, { tag: 'div', elRef: this.handleBottomEl, className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noShrink), renderProps: renderProps, generatorName: 'resourceLaneBottomContent', customGenerator: options.resourceLaneBottomContent, classNameGenerator: options.resourceLaneBottomClass })] })) }) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
        }
    }
    /*
    For the lane's events and more-links. Memoize these, for stable references
    */
    function buildResourceDateSpanProps(resourceId) {
        return { resourceId };
    }
    function buildResourceEventRenderProps(resource) {
        return { resource };
    }
    function refineResourceLaneRenderProps(input) {
        return {
            resource: new ResourceApi(input.context, input.resource),
            options: { eventOverlap: input.eventOverlap },
        };
    }

    class ResizableTwoCol extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // ref
            this.rootEl = null;
            this.startElRef = compat.createRef();
            this.resizerElRef = compat.createRef();
            this.handleRootEl = (el) => {
                this.rootEl = el;
                if (this.props.elRef) {
                    protectedApi.setRef(this.props.elRef, el);
                }
            };
        }
        render() {
            const { props, state, context } = this;
            const { options } = context;
            const widthConfig = this.widthConfig = state.widthOverride || props.initialStartWidthConfig;
            return (jsxRuntime.jsxs("div", { ref: this.handleRootEl, className: publicApi.joinClassNames(props.className, classNames__default["default"].flexRow), children: [jsxRuntime.jsx("div", { className: props.startClassName, style: {
                            width: serializeDimConfig(widthConfig),
                        }, ref: this.startElRef, children: props.startContent }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(options.resourceColumnDividerClass, classNames__default["default"].rel), 
                        // TODO: make a className somehow?...
                        // TODO: what if not resizable?
                        style: { cursor: 'col-resize' }, ref: this.resizerElRef, children: jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].hitXSkinny, classNames__default["default"].z1) }) }), jsxRuntime.jsx("div", { className: publicApi.joinClassNames(props.endClassName, classNames__default["default"].liquid), children: props.endContent })] }));
        }
        componentDidMount() {
            const ElementDraggingImpl = this.context.pluginHooks.elementDraggingImpl;
            if (ElementDraggingImpl) {
                const resizerEl = this.resizerElRef.current;
                const dragging = this.resizerDragging = new ElementDraggingImpl(resizerEl);
                dragging.emitter.on('dragstart', () => {
                    const isRtl = protectedApi.computeElIsRtl(resizerEl);
                    const viewWidth = this.rootEl.getBoundingClientRect().width;
                    const origWidth = this.startElRef.current.getBoundingClientRect().width;
                    const origWidthConfig = this.widthConfig;
                    let newWidthConfig;
                    dragging.emitter.on('dragmove', (pev) => {
                        const newWidth = Math.min(origWidth + pev.deltaX * (isRtl ? -1 : 1), viewWidth);
                        newWidthConfig = resizeDimConfig(origWidthConfig, newWidth, viewWidth);
                        this.setState({
                            widthOverride: newWidthConfig,
                        });
                    });
                    dragging.emitter.on('dragend', () => {
                        if (newWidthConfig) {
                            protectedApi.setRef(this.props.resizedWidthConfigRef, newWidthConfig);
                        }
                    });
                    dragging.setAutoScrollEnabled(false); // because gets weird with auto-scrolling time area
                });
            }
        }
        componentWillUnmount() {
            if (this.resizerDragging) {
                this.resizerDragging.destroy();
            }
        }
    }

    /*
    Cell for a resource group that can span multiple logical rows.
    */
    class ResourceGroupCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.innerElRef = compat.createRef();
        }
        render() {
            const { props, context } = this;
            const { colSpec, forPrint } = props;
            const renderProps = {
                fieldValue: props.fieldValue,
                view: context.viewApi,
            };
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'td' : 'div', attrs: forPrint ? {
                    rowSpan: props.rowSpan,
                } : {
                    ...buildAriaCellAttrs(props),
                    role: 'rowheader',
                    'aria-rowspan': props.rowSpan,
                }, className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].alignStart, !forPrint && classNames__default["default"].liquid, forPrint && classNames__default["default"].crop, forPrint && context.options.resourceRowClass, classNames__default["default"].borderlessTop, classNames__default["default"].borderlessEnd, !props.borderStart && classNames__default["default"].borderlessStart, !props.borderBottom && classNames__default["default"].borderlessBottom), renderProps: renderProps, generatorName: "resourceCellContent", customGenerator: colSpec.cellContent, defaultGenerator: renderGroupInner, classNameGenerator: colSpec.cellClass, didMount: colSpec.cellDidMount, willUnmount: colSpec.cellWillUnmount, children: (InnerContent) => (jsxRuntime.jsx("div", { ref: this.innerElRef, className: publicApi.joinClassNames(classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, classNames__default["default"].flexRow, !forPrint && classNames__default["default"].stickyT), children: jsxRuntime.jsx(InnerContent, { tag: "div", className: protectedApi.generateClassName(colSpec.cellInnerClass, renderProps) }) })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            this.disconnectInnerHeight = protectedApi.watchHeight(this.innerElRef.current, (height) => {
                if (this._isUnmounting) {
                    return;
                }
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectInnerHeight?.();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }
    function renderGroupInner(renderProps) {
        return renderProps.fieldValue || jsxRuntime.jsx(jsxRuntime.Fragment, { children: "\u00A0" });
    }

    /*
    Screen-only row wrapper for a vertically spanning resource-group cell.
    */
    class ResourceGroupSubrow extends protectedApi.BaseComponent {
        render() {
            let { props, context } = this;
            let { options } = context;
            // a grouped cell. no data that is specific to this specific resource
            // `colSpec` is for the group. a GroupSpec :(
            return (jsxRuntime.jsx("div", { role: props.role, className: publicApi.joinClassNames(options.resourceRowClass, props.className, classNames__default["default"].flexRow, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.borderBottom && classNames__default["default"].borderlessBottom), style: {
                    top: props.top,
                    height: props.height,
                    minWidth: 0,
                    width: props.width,
                    flexGrow: props.grow,
                }, children: jsxRuntime.jsx(ResourceGroupCell, { cellIdPrefix: props.cellIdPrefix, cellRowIndex: props.cellRowIndex, cellColIndex: props.cellColIndex, colSpec: props.colSpec, fieldValue: props.fieldValue, rowSpan: props.rowSpan, borderStart: props.borderStart, innerHeightRef: props.innerHeightRef }) }));
        }
    }

    class ResourceIndent extends protectedApi.BaseComponent {
        render() {
            const { props, context } = this;
            return (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(context.options.resourceIndentClass, classNames__default["default"].noShrink, classNames__default["default"].flexCol, classNames__default["default"].alignEnd, props.className), style: {
                    ...props.style,
                    width: props.indentWidth != null
                        ? props.indentWidth * props.level
                        : 0,
                }, children: props.children }));
        }
    }

    class ResourceExpander extends protectedApi.BaseComponent {
        render() {
            const { props } = this;
            const { options } = this.context;
            const classNameGenerator = options.resourceExpanderClass;
            const contentGenerator = options.resourceExpanderContent;
            const renderProps = {
                isExpanded: props.isExpanded,
            };
            return (jsxRuntime.jsx("span", { "aria-hidden": true, className: publicApi.joinClassNames(protectedApi.generateClassName(classNameGenerator, renderProps), classNames__default["default"].flexRow, classNames__default["default"].cursorPointer, classNames__default["default"].selectNone, // prevent text-selecting cell underneath
                classNames__default["default"].noMargin, props.className), onClick: props.onExpanderClick, ref: props.elRef, children: contentGenerator && (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: 'span', style: { display: 'contents' }, attrs: { 'aria-hidden': true }, renderProps: renderProps, generatorName: undefined, customGenerator: contentGenerator })) }));
        }
    }

    /*
    Group cell that spans horizontally, consuming multiple colspans
    */
    class ResourceGroupHeaderCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // ref
            this.innerElRef = compat.createRef();
            this.onExpanderClick = () => {
                let { props } = this;
                this.context.dispatch({
                    type: 'SET_RESOURCE_ENTITY_EXPANDED',
                    id: createGroupId(props.group),
                    isExpanded: !props.isExpanded,
                });
            };
        }
        render() {
            let { props, context } = this;
            let { forPrint } = props;
            let renderProps = {
                fieldValue: props.group.value,
                view: context.viewApi,
            };
            let spec = props.group.spec; // type HACK
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'td' : 'div', attrs: forPrint ? {
                    colSpan: props.colSpan,
                } : {
                    ...buildAriaCellAttrs(props),
                    role: 'rowheader',
                    'aria-colspan': props.colSpan,
                }, className: publicApi.joinClassNames(!forPrint && classNames__default["default"].liquid, // expand to whole row
                classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].alignStart, // h-align
                classNames__default["default"].crop, classNames__default["default"].contentBox, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.borderBottom && classNames__default["default"].borderlessBottom), style: forPrint ? undefined : {
                    height: props.height,
                }, renderProps: renderProps, generatorName: "resourceGroupHeaderContent", customGenerator: spec.labelContent, defaultGenerator: renderCellInner, classNameGenerator: spec.labelClass, didMount: spec.labelDidMount, willUnmount: spec.labelWillUnmount, children: (InnerContent) => (jsxRuntime.jsxs("div", { ref: this.innerElRef, className: publicApi.joinClassNames(classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, classNames__default["default"].flexRow), style: {
                        isolation: 'isolate', // TODO: className
                    }, children: [jsxRuntime.jsx(ResourceIndent, { level: 1, indentWidth: props.indentWidth, className: classNames__default["default"].z2, children: jsxRuntime.jsx(ResourceExpander, { isExpanded: props.isExpanded, onExpanderClick: this.onExpanderClick }) }), jsxRuntime.jsx(InnerContent, { tag: "div", className: publicApi.joinClassNames(protectedApi.generateClassName(spec.labelInnerClass, renderProps), classNames__default["default"].z1) })] })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            const innerEl = this.innerElRef.current;
            this.disconnectInnerHeight = protectedApi.watchHeight(innerEl, (height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectInnerHeight();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }
    ResourceGroupHeaderCell.addPropsEquality({
        group: isGroupsEqual,
    });
    function renderCellInner(renderProps) {
        return renderProps.fieldValue || jsxRuntime.jsx(jsxRuntime.Fragment, { children: "\u00A0" });
    }

    class ResourceCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.innerElRef = compat.createRef();
            this.refineRenderProps = protectedApi.memoizeObjArg(refineRenderProps);
            this.onExpanderClick = (ev) => {
                let { props } = this;
                if (props.hasChildren) {
                    this.context.dispatch({
                        type: 'SET_RESOURCE_ENTITY_EXPANDED',
                        id: props.resource.id,
                        isExpanded: !props.isExpanded,
                    });
                }
            };
        }
        render() {
            let { props, context } = this;
            let { colSpec, forPrint } = props;
            let renderProps = this.refineRenderProps({
                resource: props.resource,
                field: props.field,
                fieldValue: props.fieldValue,
                context,
            });
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'td' : 'div', attrs: {
                    ...buildAriaCellAttrs(props),
                    role: colSpec.isMain ? 'rowheader' : getAriaCellRole(props),
                    'data-resource-id': props.resource.id,
                }, className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].alignStart, forPrint && context.options.resourceRowClass, classNames__default["default"].borderlessTop, classNames__default["default"].borderlessEnd, !props.borderStart && classNames__default["default"].borderlessStart, !props.borderBottom && classNames__default["default"].borderlessBottom, classNames__default["default"].crop), style: forPrint ? undefined : {
                    minWidth: 0,
                    width: props.width,
                }, renderProps: renderProps, generatorName: "resourceCellContent", customGenerator: colSpec.cellContent, defaultGenerator: renderResourceInner, classNameGenerator: colSpec.cellClass, didMount: colSpec.cellDidMount, willUnmount: colSpec.cellWillUnmount, children: (InnerContent) => (jsxRuntime.jsxs("div", { ref: this.innerElRef, className: publicApi.joinClassNames(classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, classNames__default["default"].flexRow), style: {
                        isolation: 'isolate', // TODO: className
                    }, children: [colSpec.isMain && Boolean(props.indent) && (jsxRuntime.jsx(ResourceIndent, { level: props.indent, indentWidth: props.indentWidth, className: classNames__default["default"].z2, children: props.hasChildren && (jsxRuntime.jsx(ResourceExpander, { isExpanded: props.isExpanded, onExpanderClick: this.onExpanderClick })) })), jsxRuntime.jsx(InnerContent, { tag: "div", className: publicApi.joinClassNames(protectedApi.generateClassName(colSpec.cellInnerClass, renderProps), classNames__default["default"].z1) })] })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            this.disconnectHeight = protectedApi.watchHeight(this.innerElRef.current, (height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectHeight();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }
    function renderResourceInner(renderProps) {
        return renderProps.fieldValue || jsxRuntime.jsx(jsxRuntime.Fragment, { children: "\u00A0" });
    }
    function refineRenderProps(input) {
        return {
            resource: new ResourceApi(input.context, input.resource),
            field: input.field,
            fieldValue: input.fieldValue,
            view: input.context.viewApi,
        };
    }

    /*
    For screen-only
    */
    class ResourceSubrow extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // refs
            this.innerHeightRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleInnerHeights);
            });
            this.currentInnerHeight = null;
            this.handleInnerHeights = () => {
                if (this._isUnmounting)
                    return;
                const innerHeightMap = this.innerHeightRefMap.current;
                let max = null;
                for (const innerHeight of innerHeightMap.values()) {
                    if (max == null || innerHeight > max) {
                        max = innerHeight;
                    }
                }
                if (this.currentInnerHeight !== max) {
                    this.currentInnerHeight = max;
                    protectedApi.setRef(this.props.innerHeightRef, max);
                }
            };
        }
        render() {
            const { props, innerHeightRefMap } = this;
            const { resource, resourceFields, colSpecs } = props;
            const { options } = this.context;
            const colWidths = props.colWidths || [];
            return (jsxRuntime.jsx("div", { role: props.role, className: publicApi.joinClassNames(options.resourceRowClass, props.className, // what for???
                classNames__default["default"].flexRow, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.borderBottom && classNames__default["default"].borderlessBottom), style: {
                    top: props.top,
                    height: props.height,
                }, children: mapRange(props.colStartIndex, colSpecs.length, (i) => {
                    const colSpec = colSpecs[i];
                    const fieldValue = colSpec.field ? resourceFields[colSpec.field] :
                        (resource.title || getPublicId(resource.id));
                    return (jsxRuntime.jsx(ResourceCell, { cellIdPrefix: props.cellIdPrefix, cellRowIndex: props.cellRowIndex, inTreeGrid: props.inTreeGrid, cellColIndex: props.cellIdPrefix ? i : undefined, colSpec: colSpec, resource: resource, field: colSpec.field || 'title', fieldValue: fieldValue, indent: props.indent, hasChildren: props.hasChildren, isExpanded: props.isExpanded, innerHeightRef: innerHeightRefMap.createRef(i), width: colWidths[i], indentWidth: props.indentWidth, borderStart: props.borderStart || Boolean(i) }, i));
                }) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.currentInnerHeight = null;
        }
    }
    ResourceSubrow.addPropsEquality({
        colWidths: protectedApi.isArraysEqual,
    });
    // Utils
    // -------------------------------------------------------------------------------------------------
    function mapRange(start, end, func) {
        const items = [];
        for (let i = start; i < end; i++) {
            items.push(func(i));
        }
        return items;
    }

    /*
    Takes up no vertical space. Fills itself within outer container.
    Caller is responsible for this.
    */
    class BodySection extends protectedApi.BaseComponent {
        render() {
            const { props } = this;
            const { rowInnerHeightRefMap, headerRowSpan } = props;
            const groupColCnt = props.groupCellCnts.length;
            const colWidths = props.colWidths || [];
            return (jsxRuntime.jsxs("div", { className: classNames__default["default"].flexRow, style: {
                    minWidth: props.canvasWidth,
                    minHeight: props.canvasHeight,
                }, children: [props.groupColPositions.map((groupCellPositions, colIndex) => (jsxRuntime.jsx("div", { role: "presentation", className: classNames__default["default"].rel /* origin for abs-positioned rows */, style: {
                            height: 0,
                            minWidth: 0,
                            width: colWidths[colIndex],
                        }, children: groupCellPositions.map((groupCellPosition, groupIndex) => {
                            const groupCellLayout = groupCellPosition.item;
                            const group = groupCellLayout.entity;
                            const groupKey = groupCellPosition.key;
                            const isNotLast = groupIndex < groupCellPositions.length - 1;
                            const rowHeight = groupCellPosition.size;
                            return (jsxRuntime.jsx(ResourceGroupSubrow, { colSpec: group.spec, rowSpan: groupCellLayout.rowSpan, fieldValue: group.value, className: classNames__default["default"].fillX, borderStart: Boolean(colIndex), borderBottom: isNotLast, role: "presentation", cellIdPrefix: props.cellIdPrefix, cellRowIndex: 1 + headerRowSpan + groupCellLayout.rowIndex, cellColIndex: colIndex, innerHeightRef: rowInnerHeightRefMap.createRef(groupKey), top: groupCellPosition.start, height: (rowHeight != null && isNotLast)
                                    ? rowHeight + ROW_BORDER_WIDTH // considering bottom border, which is added to cell
                                    : rowHeight }, groupKey));
                        }) }, colIndex))), jsxRuntime.jsxs("div", { role: "presentation", className: classNames__default["default"].rel, style: {
                            height: 0,
                            minWidth: 0,
                            width: sumArray(colWidths.slice(groupColCnt)),
                        }, children: [props.groupRowPositions.map((rowPosition) => {
                                const groupRowLayout = rowPosition.item;
                                const group = groupRowLayout.entity;
                                const groupKey = rowPosition.key;
                                // Compare against every expansion-filtered row, not only the virtualized subset.
                                const isNotLast = groupRowLayout.visibleIndex < props.displayedRowCnt - 1;
                                return (jsxRuntime.jsx("div", { role: "presentation", className: publicApi.joinClassNames(classNames__default["default"].fillX, classNames__default["default"].flexRow), style: {
                                        top: rowPosition.start,
                                    }, children: jsxRuntime.jsx(ResourceGroupHeaderCell, { cellIdPrefix: props.cellIdPrefix, cellRowIndex: 1 + headerRowSpan + groupRowLayout.rowIndex, cellColIndex: 0, group: group, isExpanded: groupRowLayout.isExpanded, innerHeightRef: rowInnerHeightRefMap.createRef(groupKey), colSpan: props.colSpecs.length, borderBottom: isNotLast, height: rowPosition.size, indentWidth: props.indentWidth }) }, groupKey));
                            }), props.resourceRowPositions.map((rowPosition) => {
                                const resourceLayout = rowPosition.item;
                                const resource = resourceLayout.entity;
                                const rowHeight = rowPosition.size;
                                // Compare against every expansion-filtered row, not only the virtualized subset.
                                const isNotLast = resourceLayout.visibleIndex < props.displayedRowCnt - 1;
                                return (jsxRuntime.jsx(ResourceSubrow, { resource: resource, resourceFields: resourceLayout.resourceFields, indent: resourceLayout.indent, hasChildren: resourceLayout.hasChildren, isExpanded: resourceLayout.isExpanded, colStartIndex: groupColCnt, colSpecs: props.colSpecs, colWidths: colWidths, innerHeightRef: rowInnerHeightRefMap.createRef(resource.id), className: classNames__default["default"].fillX, borderStart: Boolean(groupColCnt), borderBottom: isNotLast, role: "presentation", cellIdPrefix: props.cellIdPrefix, inTreeGrid: props.inTreeGrid, cellRowIndex: 1 + headerRowSpan + resourceLayout.rowIndex, top: rowPosition.start, height: (rowHeight != null && isNotLast)
                                        ? rowHeight + ROW_BORDER_WIDTH // considering bottom border, which is added to cell
                                        : rowHeight, indentWidth: props.indentWidth }, resource.id /* TODO: use rowPosition.key? */));
                            })] })] }));
        }
    }
    // Utils
    // -------------------------------------------------------------------------------------------------
    function sumArray(a) {
        let sum = 0;
        for (const num of a) {
            sum += num;
        }
        return sum;
    }

    class HeaderCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // ref
            this.innerElRef = compat.createRef();
        }
        render() {
            let { props, context } = this;
            let { colSpec, forPrint } = props;
            let renderProps = { view: context.viewApi };
            // need empty inner div for abs positioning for resizer
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'th' : 'div', attrs: {
                    ...buildAriaCellAttrs(props),
                    role: 'columnheader',
                }, className: publicApi.joinClassNames(forPrint && context.options.resourceHeaderRowClass, classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].borderlessY, classNames__default["default"].borderlessEnd, !props.borderStart && classNames__default["default"].borderlessStart, classNames__default["default"].rel), style: forPrint ? undefined : {
                    minWidth: 0,
                    width: props.width,
                }, renderProps: renderProps, generatorName: "resourceColumnHeaderContent", customGenerator: colSpec.headerContent, defaultGenerator: colSpec.headerDefault, classNameGenerator: colSpec.headerClass, didMount: colSpec.headerDidMount, willUnmount: colSpec.headerWillUnmount, children: (InnerContent) => (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].crop, // must crop instead of outer
                            classNames__default["default"].flexCol, classNames__default["default"].alignStart), children: jsxRuntime.jsxs("div", { ref: this.innerElRef, className: publicApi.joinClassNames(classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, classNames__default["default"].flexRow), children: [this.props.indent && (jsxRuntime.jsx(ResourceIndent, { level: 1, indentWidth: props.indentWidth })), jsxRuntime.jsx(InnerContent, { tag: "div", className: protectedApi.generateClassName(colSpec.headerInnerClass, renderProps) })] }) }), props.resizer && !forPrint && (jsxRuntime.jsx("div", { ref: props.resizerElRef, className: publicApi.joinClassNames(protectedApi.generateClassName(colSpec.headerResizerClass, renderProps), classNames__default["default"].z1, classNames__default["default"].cursorColResizer) }))] })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            const innerEl = this.innerElRef.current;
            this.disconnectInnerHeight = protectedApi.watchHeight(innerEl, (height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectInnerHeight();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }

    class HeaderCells extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // refs
            this.resizerElRefMap = new protectedApi.RefMap((resizerEl, index) => {
                let { colDraggings } = this;
                if (!resizerEl) {
                    let dragging = colDraggings[index];
                    if (dragging) {
                        dragging.destroy();
                        delete colDraggings[index];
                    }
                }
                else {
                    let dragging = this.initColResizing(resizerEl, index);
                    if (dragging) {
                        colDraggings[index] = dragging;
                    }
                }
            });
            this.innerHeightRefMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleInnerHeights);
            });
            this.colDraggings = {};
            this.handleInnerHeights = () => {
                if (this._isUnmounting)
                    return;
                const { innerHeightRefMap } = this;
                let max = 0;
                for (const innerHeight of innerHeightRefMap.current.values()) {
                    max = Math.max(max, innerHeight);
                }
                if (this.currentInnerHeight !== max) {
                    this.currentInnerHeight = max;
                    protectedApi.setRef(this.props.innerHeightRef, max);
                }
            };
        }
        render() {
            const { props, innerHeightRefMap, resizerElRefMap } = this;
            const { colSpecs } = props;
            const colWidths = props.colWidths || [];
            return (jsxRuntime.jsx(jsxRuntime.Fragment, { children: colSpecs.map((colSpec, colIndex) => (jsxRuntime.jsx(HeaderCell, { cellIdPrefix: props.cellIdPrefix, cellRowIndex: props.rowIndex != null ? 1 + props.rowIndex : undefined, cellColIndex: props.cellIdPrefix ? colIndex : undefined, width: colWidths[colIndex], colSpec: colSpec, resizer: colIndex < colSpecs.length - 1, indent: colSpec.isMain && props.indent, resizerElRef: resizerElRefMap.createRef(colIndex), innerHeightRef: innerHeightRefMap.createRef(colIndex), borderStart: Boolean(colIndex), indentWidth: props.indentWidth, forPrint: props.forPrint }, colIndex))) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.currentInnerHeight = undefined;
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
        // Dragging
        // -----------------------------------------------------------------------------------------------
        initColResizing(resizerEl, colIndex) {
            let { pluginHooks } = this.context;
            let ElementDraggingImpl = pluginHooks.elementDraggingImpl;
            if (ElementDraggingImpl) {
                let dragging = new ElementDraggingImpl(resizerEl);
                dragging.emitter.on('dragstart', () => {
                    const isRtl = protectedApi.computeElIsRtl(resizerEl);
                    const startWidth = this.props.colWidths[colIndex];
                    dragging.emitter.on('dragmove', (pev) => {
                        if (this.props.onColResize) {
                            this.props.onColResize(colIndex, startWidth + pev.deltaX * (isRtl ? -1 : 1));
                        }
                    });
                    // because gets weird with auto-scrolling time area
                    dragging.setAutoScrollEnabled(false);
                });
                return dragging;
            }
            return null;
        }
    }

    /*
    TODO: make more DRY with HeaderCell. Almost exactly the same except doesn't need resizer
    */
    class SuperHeaderCell extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            // refs
            this.innerElRef = compat.createRef();
        }
        render() {
            let { props, context } = this;
            let { renderHooks, forPrint } = props;
            let renderProps = { view: context.viewApi };
            const { options } = context;
            return (jsxRuntime.jsx(protectedApi.ContentContainer, { tag: forPrint ? 'th' : 'div', attrs: {
                    ...buildAriaCellAttrs(this.props),
                    role: 'columnheader',
                    'aria-colspan': this.props.colSpan,
                    colSpan: forPrint ? props.colSpan : undefined,
                }, className: publicApi.joinClassNames(forPrint && options.resourceHeaderRowClass, !forPrint && classNames__default["default"].liquid, classNames__default["default"].noMargin, classNames__default["default"].noPadding, !forPrint && classNames__default["default"].flexCol, classNames__default["default"].alignStart, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !forPrint && classNames__default["default"].borderlessBottom, !forPrint && classNames__default["default"].crop), renderProps: renderProps, generatorName: "resourceColumnHeaderContent", customGenerator: renderHooks.headerContent, defaultGenerator: renderHooks.headerDefault, classNameGenerator: renderHooks.headerClass, didMount: renderHooks.headerDidMount, willUnmount: renderHooks.headerWillUnmount, children: (InnerContent) => (jsxRuntime.jsxs("div", { ref: this.innerElRef, className: publicApi.joinClassNames(classNames__default["default"].noShrink, classNames__default["default"].whiteSpaceNoWrap, classNames__default["default"].flexRow), children: [this.props.indent && (jsxRuntime.jsx(ResourceIndent, { level: 1, indentWidth: this.props.indentWidth })), jsxRuntime.jsx(InnerContent, { tag: "div", className: protectedApi.generateClassName(renderHooks.headerInnerClass, renderProps) })] })) }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            const innerEl = this.innerElRef.current;
            this.disconnectInnerHeight = protectedApi.watchHeight(innerEl, (height) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.innerHeightRef, height);
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectInnerHeight();
            protectedApi.setRef(this.props.innerHeightRef, null);
        }
    }

    class Virtualizer {
        constructor(getItemKey, getItemStart, getItemSize, 
        // called when viewport changes and Virtualizer wants caller (aka renderer) to rerender items
        requestRerender, overscan = 1) {
            this.getItemKey = getItemKey;
            this.getItemStart = getItemStart;
            this.getItemSize = getItemSize;
            this.requestRerender = requestRerender;
            this.overscan = overscan;
            // left exposed so they can be prepopulated :(
            this.viewportSize = 0;
            this.scroll = 0;
            this.items = [];
        }
        computePositions(items, disabled, forcedScroll) {
            if (disabled) {
                this.items = [];
                this.itemPositions = undefined; // affects _handleViewportChange
                return this.computeAllPositions(items);
            }
            this.items = items;
            if (forcedScroll !== undefined) {
                this.scroll = forcedScroll;
            }
            if (!this.viewportSize) {
                return [];
            }
            return (this.itemPositions = this.computePositionsInRange(items));
        }
        handleViewportSize(size) {
            if (size !== this.viewportSize) {
                this.viewportSize = size;
                this._handleViewportChange();
            }
        }
        handleScroll(scroll) {
            if (scroll !== this.scroll) {
                this.scroll = scroll;
                this._handleViewportChange();
            }
        }
        _handleViewportChange() {
            if (this.itemPositions) {
                const testItemPositions = this.computePositionsInRange(this.items);
                // Cheap test for whether rows in the visible scroll-window changed and repositioning needed.
                // Only handles changes because of *scroll-window*, NOT because of underlying row data change,
                // which caller is responsible for rerendering themselves
                if (testItemPositions.length !== this.itemPositions.length || (testItemPositions.length &&
                    testItemPositions[0].index !== this.itemPositions[0].index)) {
                    this.requestRerender();
                }
            }
        }
        computePositionsInRange(items) {
            const { scroll, viewportSize, getItemKey, getItemStart, getItemSize, overscan } = this;
            const count = items.length;
            let itemPositions = [];
            let index = 0;
            let runningStart = 0;
            while (index < count) {
                const item = items[index];
                const key = getItemKey(item);
                const start = getItemStart ? getItemStart(key, index, item) : runningStart;
                const size = getItemSize(key, index, item);
                if (start + size > scroll) {
                    break;
                }
                index++;
                runningStart += size;
            }
            // back up for underscan
            const startIndex = Math.max(index - overscan, 0);
            while (index > startIndex) {
                const item = items[index - 1];
                const key = getItemKey(item);
                const size = getItemSize(key, index - 1, item);
                index--;
                runningStart -= size;
            }
            while (index < count) {
                const item = items[index];
                const key = getItemKey(item);
                const start = getItemStart ? getItemStart(key, index, item) : runningStart;
                const size = getItemSize(key, index, item);
                if (start >= scroll + viewportSize) {
                    break;
                }
                itemPositions.push({
                    item,
                    key,
                    index,
                    start,
                    size,
                });
                index++;
                runningStart += size;
            }
            const endIndex = Math.min(index + overscan, count);
            // overshoot for overscan
            while (index < endIndex) {
                const item = items[index];
                const key = getItemKey(item);
                const start = getItemStart ? getItemStart(key, index, item) : runningStart;
                const size = getItemSize(key, index, item);
                itemPositions.push({
                    item,
                    key,
                    index,
                    start,
                    size,
                });
                index++;
                runningStart += size;
            }
            return itemPositions;
        }
        computeAllPositions(items) {
            const { getItemKey, getItemStart, getItemSize } = this;
            let runningStart = 0;
            return items.map((item, index) => {
                const key = getItemKey(item);
                const start = getItemStart ? getItemStart(key, index, item) : runningStart;
                const size = getItemSize(key, index, item);
                runningStart += size;
                return {
                    item,
                    key,
                    index,
                    start,
                    size,
                };
            });
        }
    }
    function computeShift(itemPositions) {
        const count = itemPositions.length;
        if (count) {
            const start = itemPositions[0].start;
            const end = itemPositions[count - 1].start + itemPositions[count - 1].size;
            return [start, end, itemPositions[0].index];
        }
    }

    function computeResourceTimelineHeaderHeight(dataGridHeaderRowInnerHeightMap, timelineHeaderRowInnerHeightMap, hasDataGridSuperHeader, timelineHeaderRowCnt) {
        const dataGridKeys = (hasDataGridSuperHeader ? [true] : []).concat(false);
        let dataGridHeight = 0;
        for (const key of dataGridKeys) {
            const rowHeight = dataGridHeaderRowInnerHeightMap.get(key);
            if (rowHeight == null) {
                return;
            }
            dataGridHeight += rowHeight;
        }
        let timelineHeight = 0;
        for (let rowIndex = 0; rowIndex < timelineHeaderRowCnt; rowIndex += 1) {
            const rowHeight = timelineHeaderRowInnerHeightMap.get(rowIndex);
            if (rowHeight == null) {
                return;
            }
            timelineHeight += rowHeight;
        }
        return Math.max(dataGridHeight + (hasDataGridSuperHeader ? ROW_BORDER_WIDTH : 0), timelineHeight + ROW_BORDER_WIDTH * (timelineHeaderRowCnt - 1));
    }

    const defaultOwnCellHeight = 40;
    const rowHeightSampleSize = 30;
    class ResourceTimelineLayoutNormal extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memoized
            this.buildResourceLayouts = protectedApi.memoize(buildResourceLayouts);
            // amount of extra space that should be temporarily added to vertical rows
            // after setting, must call forceUpdate
            // only supported for bodyScroller (aka getIsHeightAuto()===false)
            this.scrollSlack = 0;
            this.queuedEntityScroll = false;
            // the assumed height of rows that haven't been measured yet
            this.estimatedRowHeight = defaultOwnCellHeight;
            this.recentlyMeasuredRowKeys = []; // the last rowHeightSampleSize, oldest first
            // A row is as tall as its taller cell, so a cell's change in height is not the row's. An empty
            // lane, for example, is much shorter than its row, and has no effect on the row's height
            this.handleSpreadsheetCellHeightChange = (val, key, oldVal) => {
                const timeHeight = this.timeEntityInnerHeightMap.current.get(key) || 0;
                if (oldVal == null) {
                    this.recentlyMeasuredRowKeys.push(key);
                    if (this.recentlyMeasuredRowKeys.length > rowHeightSampleSize) {
                        this.recentlyMeasuredRowKeys.shift();
                    }
                }
                this.handleBodyRowHeightChange(key, Math.max(oldVal ?? this.estimatedRowHeight, timeHeight), Math.max(val, timeHeight));
            };
            this.handleTimeCellHeightChange = (val, key, oldVal) => {
                const spreadsheetHeight = this.dataGridEntityInnerHeightMap.current.get(key) ?? this.estimatedRowHeight;
                this.handleBodyRowHeightChange(key, Math.max(spreadsheetHeight, oldVal || 0), Math.max(spreadsheetHeight, val));
            };
            // This is a means to recompute row positioning when *HeightMaps change
            this.handleBodyRowHeightChange = (key, oldHeight, newHeight) => {
                if (this._isUnmounting)
                    return;
                if (this.isScrolling) {
                    const scrollSlackDelta = oldHeight - newHeight;
                    if (scrollSlackDelta) {
                        const topCoord = this.bodyTops.get(key);
                        // Live scroll position, because currentEntityScroll lags when the browser clamps the
                        // scroll after content shrinks, and its scroll event hasn't fired yet
                        if (topCoord != null && topCoord < this.bodyScroller.y) {
                            if (!protectedApi.getIsHeightAuto(this.context.options)) {
                                // console.log('DELTA', key, oldHeight, '->', newHeight)
                                this.scrollSlack += scrollSlackDelta;
                            }
                        }
                    }
                }
                else {
                    this.queuedEntityScroll = true;
                }
                protectedApi.afterSize(this.boundForceUpdate);
            };
            this.handleHeaderRowHeightChange = () => {
                if (this._isUnmounting)
                    return;
                protectedApi.afterSize(this.boundForceUpdate);
            };
            this.boundForceUpdate = () => {
                if (this._isUnmounting)
                    return;
                this.forceUpdate();
            };
            this.spreadsheetHeaderScrollerRef = compat.createRef();
            this.spreadsheetBodyScrollerRef = compat.createRef();
            this.spreadsheetFooterScrollerRef = compat.createRef();
            this.timeHeaderScrollerRef = compat.createRef();
            this.timeBodyScrollerRef = compat.createRef();
            this.timeFooterScrollerRef = compat.createRef();
            this.headerRowInnerWidthMap = new protectedApi.RefMap(() => {
                protectedApi.afterSize(this.handleSlotInnerWidths);
            });
            // TODO: give simpler handlers to this???
            this.timelineHeaderRowInnerHeightMap = new protectedApi.RefMap(this.handleHeaderRowHeightChange);
            this.dataGridHeaderRowInnerHeightMap = new protectedApi.RefMap(this.handleHeaderRowHeightChange);
            // keyed by createEntityId
            // NOTE: ignoring deletes can cause memory issues if resources constantly change and have new keys
            // refactor in future. FWIW, TanStack Virtual doesn't garbage collect unnused dimensions either
            this.dataGridEntityInnerHeightMap = new protectedApi.RefMap(this.handleSpreadsheetCellHeightChange, /* ignoreDeletes = */ true);
            this.timeEntityInnerHeightMap = new protectedApi.RefMap(this.handleTimeCellHeightChange, /* ignoreDeletes = */ true);
            // updated in-place
            // .time takes precedence
            // to operate on pixel value (.x), clear time
            this.scroll = {};
            // virtualizers
            this.getEntityTop = (key) => this.bodyTops.get(key);
            this.getEntityHeight = (key) => this.bodyHeights.get(key);
            this.rowVirtualizer = new Virtualizer((rowLayout) => createEntityId(rowLayout.entity), this.getEntityTop, this.getEntityHeight, this.boundForceUpdate);
            this.groupColVirtualizers = [];
            this.slotVirtualizer = new Virtualizer((slotKey) => slotKey, (_key, index) => index * (this.props.slotWidth ?? ESTIMATED_SLOT_WIDTH), () => this.props.slotWidth ?? ESTIMATED_SLOT_WIDTH, this.boundForceUpdate, 
            /* overscan = */ 3);
            this.timeHeaderVirtualizers = [];
            // Sizing
            // -----------------------------------------------------------------------------------------------
            this.handleSpreadsheetClientWidth = (spreadsheetClientWidth) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.spreadsheetClientWidthRef, spreadsheetClientWidth);
            };
            this.handleSpreadsheetBottomScrollbarWidth = (spreadsheetBottomScrollbarWidth) => {
                this.setState({
                    spreadsheetBottomScrollbarWidth,
                });
            };
            this.handleTimeTotalWidth = (timeTotalWidth) => {
                if (this._isUnmounting)
                    return;
                this.setState({
                    timeTotalWidth,
                });
            };
            this.handleTimeClientWidth = (timeClientWidth) => {
                if (this._isUnmounting)
                    return;
                protectedApi.setRef(this.props.timeClientWidthRef, timeClientWidth);
                this.setState({
                    timeClientWidth,
                });
                this.slotVirtualizer.handleViewportSize(timeClientWidth);
                for (const timeHeaderVirtualizer of this.timeHeaderVirtualizers) {
                    timeHeaderVirtualizer.handleViewportSize(timeClientWidth);
                    // TODO: what about difference in scrollbar width?
                }
            };
            this.handleTimeClientHeight = (timeClientHeight) => {
                if (this._isUnmounting)
                    return;
                this.setState({
                    timeClientHeight,
                });
                if (!protectedApi.getIsHeightAuto(this.context.options)) {
                    this.setVirtualizerViewportSize(timeClientHeight);
                }
            };
            this.handleTimeBottomScrollbarWidth = (timeBottomScrollbarWidth) => {
                if (this._isUnmounting)
                    return;
                this.setState({
                    timeBottomScrollbarWidth,
                });
            };
            this.handleSlotInnerWidths = () => {
                if (this._isUnmounting)
                    return;
                const headerSlotInnerWidth = this.headerRowInnerWidthMap.current.get(this.props.tDateProfile.cellRows.length - 1);
                if (headerSlotInnerWidth != null && headerSlotInnerWidth !== this.slotInnerWidth) {
                    this.slotInnerWidth = headerSlotInnerWidth;
                    protectedApi.setRef(this.props.slotInnerWidthRef, headerSlotInnerWidth);
                }
            };
            this.updateVirtualizerScroll = protectedApi.debounce(() => {
                const scroll = this.currentEntityScroll;
                this.rowVirtualizer.handleScroll(scroll);
                for (const groupColVirtualizer of this.groupColVirtualizers) {
                    groupColVirtualizer.handleScroll(scroll);
                }
            }, 10)[0];
            // Window Scrolling
            // -----------------------------------------------------------------------------------------------
            this.isTrackingWindowScroll = false;
            this.bodyOffset = 0;
            this.lastOffsetQuery = 0;
            this.handleWindowScroll = () => {
                const scrollY = window.scrollY;
                const now = Date.now();
                if (now - this.lastOffsetQuery > 200) {
                    this.lastOffsetQuery = now;
                    this.bodyOffset = this.bodyEl.getBoundingClientRect().top + scrollY;
                }
                this.handleAnyEntityScroll(scrollY - this.bodyOffset);
            };
            this.handleTimeScrollRequest = (timeScroll) => {
                this.scroll.time = timeScroll;
                this.applyTimeScroll();
            };
            // HACKY
            // can't use isDevice because we want programmatic .scrollLeft assignments to work with scroll-virtualization too.
            // the main reason we use a isDevice gate is to prevent the initial-scroll assignment from triggering handleTimeScroll,
            // but the debounce luckily helps us in this case
            this.handleTimeScroll = (_isDevice, scroll) => {
                this.scroll.x = scroll;
                this._handleTimeScroll();
            };
            this._handleTimeScroll = protectedApi.debounce(() => {
                this.scroll.time = undefined; // prevents computeTimeScroll from computing based on time
                const scrollX = this.scroll.x;
                this.slotVirtualizer.handleScroll(scrollX);
                for (const timeHeaderVirtualizer of this.timeHeaderVirtualizers) {
                    timeHeaderVirtualizer.handleScroll(scrollX);
                }
            }, 10)[0];
            this.handleTimeScrollEnd = () => {
                protectedApi.setRef(this.props.scrollRef, this.scroll);
            };
            this.isScrolling = false;
            // REQUESTED scroll by external systems
            // (for bodyScroller only, NOT window)
            this.handleResourceScrollRequest = (resourceId) => {
                this.scroll.entityId = resourceId;
                this.scroll.fromBottom = undefined;
                // The resource might not be rendered yet, such as when added within batchRendering. Otherwise
                // render() would virtualize rows around the requested scroll without ever applying it
                if (!this.applyEntityScroll()) {
                    this.queuedEntityScroll = true;
                }
            };
            // START vertical scroll
            // (for bodyScroller only, NOT window)
            this.handleEntityScrollStart = () => {
                this.isScrolling = true;
            };
            // DURING verical scroll
            // (for bodyScroller only, NOT window)
            this.handleEntityScroll = (isDevice, scroll) => {
                // The layout's own scroll to a cut-short position keeps its anchor (see applyEntityScroll). Any
                // other scroll drops it. Decided here, with the moving scroller's position: at scroll start, the
                // syncer hasn't picked that scroller yet
                if (isDevice || !this.isCutShortEntityScroll(scroll)) {
                    this.cutShortEntityScrollY = undefined;
                    this.scroll.entityId = undefined;
                    this.scroll.fromBottom = undefined;
                }
                if (!protectedApi.getIsHeightAuto(this.context.options)) {
                    this.handleAnyEntityScroll(scroll);
                    // natural handler for vertical scroll, for either div or window scroll
                    // if scrolls into slack area, move scroll to zero ASAP
                    if (scroll < this.scrollSlack) {
                        // console.log('ABORT', this.scrollSlack)
                        this.scrollSlack = 0;
                        this.forceUpdate(() => {
                            this.bodyScroller.scrollTo({ y: 0 });
                        });
                    }
                }
            };
            // END vertical scroll
            // (for bodyScroller only, NOT window)
            this.handleEntityScrollEnd = () => {
                this.isScrolling = false;
                if (!this.isTrackingWindowScroll) {
                    const { bodyLayouts, bodyTops, bodyHeights, scroll } = this;
                    const y = this.bodyScroller.y;
                    if (this.isCutShortEntityScroll(y)) {
                        // keep the anchor, and apply it again now that rows measured during the scroll have heights
                        this.queuedEntityScroll = true;
                    }
                    else if (!y) {
                        // If already at top, keep at top. Anchoring to the first row would hide any rows that are
                        // later inserted above it
                        scroll.entityId = undefined;
                        scroll.fromBottom = undefined;
                    }
                    else {
                        const coordRes = findEntityByCoord(bodyLayouts, bodyTops, bodyHeights, y, createEntityId);
                        if (coordRes) {
                            const [entity, elTop, elHeight] = coordRes;
                            scroll.entityId = createEntityId(entity);
                            scroll.fromBottom = elTop + elHeight - y;
                        }
                    }
                    // At scrolling end, convert scrollSlack into real scroll and zero out. The anchor above is
                    // relative to the row, so it also holds if this rerender changes estimatedRowHeight
                    if (this.scrollSlack) {
                        // console.log('CONSUMING', this.scrollSlack)
                        this.scrollSlack = 0;
                        this.queuedEntityScroll = true;
                    }
                    // Virtualization always rerenders, because rows measured during the scroll can change
                    // estimatedRowHeight. Otherwise, all rows are measured from the start
                    if (this.queuedEntityScroll || this.context.options.virtualization) {
                        this.forceUpdate();
                    }
                }
            };
            // Hit System
            // -----------------------------------------------------------------------------------------------
            this.handleBodyEl = (el) => {
                this.bodyEl = el;
                if (el) {
                    this.context.registerInteractiveComponent(this, { el });
                }
                else {
                    this.context.unregisterInteractiveComponent(this);
                }
            };
        }
        render() {
            let { props, state, context } = this;
            let { dateProfile, hasNesting } = props;
            let { options, viewSpec } = context;
            const { borderlessX, borderlessTop, borderlessBottom } = protectedApi.computeViewBorderless(options);
            let { spreadsheetBottomScrollbarWidth, timeTotalWidth, timeClientWidth, timeClientHeight, timeBottomScrollbarWidth } = state;
            /* date */
            const { tDateProfile } = props;
            let { cellRows } = tDateProfile;
            /* table settings */
            let allowVerticalScrolling = !protectedApi.getIsHeightAuto(options);
            let tableHeaderSticky = protectedApi.getTableHeaderSticky(options);
            let footerScrollbarSticky = protectedApi.getFooterScrollbarSticky(options);
            const { colSpecs, groupColCnt, superHeaderRendering } = props;
            /* table hierarchy */
            const { resourceHierarchy } = props;
            const superHeaderRowSpan = superHeaderRendering ? 1 : 0;
            const totalHeaderRowSpan = superHeaderRowSpan + 1;
            /* table display */
            let { layouts: bodyLayouts, flatRowLayouts, flatGroupColLayouts, totalCnt, } = this.buildResourceLayouts(resourceHierarchy, hasNesting, props.resourceEntityExpansions, options.resourcesInitiallyExpanded);
            this.bodyLayouts = bodyLayouts;
            // update groupColVirtualizers
            let groupColVirtualizers = this.groupColVirtualizers;
            let oldLen = groupColVirtualizers.length;
            let newLen = flatGroupColLayouts.length;
            if (newLen > oldLen) {
                for (let i = oldLen; i < newLen; i++) {
                    groupColVirtualizers[i] = new Virtualizer((groupCellLayout) => createGroupId(groupCellLayout.entity), this.getEntityTop, this.getEntityHeight, this.boundForceUpdate);
                }
            }
            else if (newLen < oldLen) {
                groupColVirtualizers = groupColVirtualizers.slice(0, newLen);
            }
            this.groupColVirtualizers = groupColVirtualizers;
            // update timeHeaderVirtualizers
            let timeHeaderVirtualizers = this.timeHeaderVirtualizers;
            oldLen = timeHeaderVirtualizers.length;
            newLen = cellRows.length;
            if (newLen > oldLen) {
                for (let i = oldLen; i < newLen; i++) {
                    timeHeaderVirtualizers[i] = new Virtualizer((cell) => cell.key, undefined, // getItemStart (let Virtualizer compute it)
                    (key, index, cell) => cell.colspan * (this.props.slotWidth ?? ESTIMATED_SLOT_WIDTH), this.boundForceUpdate);
                    // HACK to prepopulate
                    timeHeaderVirtualizers[i].viewportSize = timeHeaderVirtualizers[0].viewportSize;
                    timeHeaderVirtualizers[i].scroll = timeHeaderVirtualizers[0].scroll;
                }
            }
            this.timeHeaderVirtualizers = timeHeaderVirtualizers;
            // Expansion-filtered rows, including those outside the virtualized viewport.
            // `totalCnt` also includes collapsed descendants; `rowPositions` below is the mounted subset.
            const displayedRowCnt = flatRowLayouts.length;
            /* table positions */
            // does not include bottom border between header and body
            const headerHeight = computeResourceTimelineHeaderHeight(this.dataGridHeaderRowInnerHeightMap.current, this.timelineHeaderRowInnerHeightMap.current, Boolean(superHeaderRendering), tDateProfile.cellRows.length);
            let endScrollbarWidth = (timeTotalWidth != null && timeClientWidth != null)
                ? timeTotalWidth - timeClientWidth
                : undefined;
            this.updateEstimatedRowHeight();
            // totalBodyHeight is the height WITHIN the scrollers
            let [bodyHeights, totalBodyHeight] = computeHeights(// TODO: memoize?
            bodyLayouts, createEntityId, (entityKey) => {
                const entitySpreadsheetHeight = this.dataGridEntityInnerHeightMap.current.get(entityKey) ?? this.estimatedRowHeight;
                // map doesn't contain group-column-cell heights, thus ||0
                // TODO: better use estimatedRowHeight
                const entityTimeHeight = this.timeEntityInnerHeightMap.current.get(entityKey) || 0;
                return Math.max(entitySpreadsheetHeight, entityTimeHeight);
            }, 
            /* minHeight = */ (allowVerticalScrolling && options.expandRows)
                ? timeClientHeight
                : undefined);
            this.bodyHeights = bodyHeights;
            let bodyTops = computeTopsFromHeights(bodyLayouts, createEntityId, bodyHeights, this.scrollSlack);
            this.bodyTops = bodyTops;
            /* virtualize */
            const virtualizationDisabled = !options.virtualization;
            // ensure in-range items are computed with most recent scroll, even tho maybe not applied yet
            const forcedEntityScroll = this.computeEntityScroll();
            const rowPositions = this.rowVirtualizer.computePositions(flatRowLayouts, virtualizationDisabled, forcedEntityScroll);
            // Keep render loops component-type-specific for future row recycling.
            const groupRowPositions = [];
            const resourceRowPositions = [];
            for (const rowPosition of rowPositions) {
                if ('resourceFields' in rowPosition.item) {
                    resourceRowPositions.push(rowPosition);
                }
                else {
                    groupRowPositions.push(rowPosition);
                }
            }
            const groupColPositions = this.groupColVirtualizers.map((groupColVirtualizer, i) => {
                return groupColVirtualizer.computePositions(flatGroupColLayouts[i], virtualizationDisabled, forcedEntityScroll);
            });
            // Scope deterministic row/column cell IDs to this calendar instance.
            const cellIdPrefix = `${context.baseId}rt`;
            const ariaBodyRows = buildAriaBodyRows(flatRowLayouts, groupColPositions, rowPositions, groupColCnt, colSpecs.length);
            // Only paint vertical fills/lines that are in view
            // Big performance impact for very tall virtualized lists
            // NOTE: could be zero rows and groups!
            const rowPositionShift = computeShift(rowPositions);
            const yFillTop = rowPositionShift?.[0] ?? 0;
            const yFillBottom = rowPositionShift?.[1] ?? 0;
            let yFillHeight;
            if (allowVerticalScrolling) {
                yFillHeight = timeClientHeight != null
                    ? Math.max(yFillBottom, timeClientHeight) - yFillTop
                    : undefined;
            }
            else {
                yFillHeight = yFillBottom - yFillTop;
            }
            // Uses the same slot geometry as slotVirtualizer, which is estimated until measured.
            // When the canvas fits without scrolling, scrollTo() is a no-op that fires no scroll event,
            // so an uncapped time-based scroll would linger and the virtualizer would skip the leading
            // slots (#8093)
            this.maxHScroll = timeClientWidth != null
                ? Math.max(0, tDateProfile.slotCnt * (props.slotWidth ?? ESTIMATED_SLOT_WIDTH) - timeClientWidth)
                : undefined;
            const forcedTimeScroll = this.computeTimeScroll();
            const slotDatePositions = this.slotVirtualizer.computePositions(tDateProfile.slotKeys, virtualizationDisabled, forcedTimeScroll);
            const slotDateShift = computeShift(slotDatePositions);
            /* */
            const { timeCanvasWidth } = props;
            const slotWidth = props.slotWidth ?? ESTIMATED_SLOT_WIDTH;
            const { spreadsheetColWidths, spreadsheetCanvasWidth } = props;
            /* event display */
            const { splitProps, bgSlicedProps } = props;
            /* business hour display */
            const { hasResourceBusinessHours, fallbackBusinessHours } = props;
            const enableNowIndicator = // TODO: DRY
             options.nowIndicator &&
                isNowInTimelineRange(props.nowDate, props.dateProfile, props.tDateProfile);
            /* filler */
            const spreadsheetBottomFiller = Math.max(0, (timeBottomScrollbarWidth || 0) -
                (spreadsheetBottomScrollbarWidth || 0));
            const timelineBottomFiller = Math.max(0, (spreadsheetBottomScrollbarWidth || 0) -
                (timeBottomScrollbarWidth || 0));
            const maxVScroll = this.maxVScroll =
                (allowVerticalScrolling && timeClientHeight != null)
                    ? Math.max(0, totalBodyHeight - timeClientHeight)
                    : 0;
            const allowBottomFiller = !options.expandRows && // if rows expand, then we never need filler
                !maxVScroll; // no scrolling possible
            const spreadsheetNeedsBottomFiller = allowBottomFiller || Boolean(spreadsheetBottomFiller);
            const timelineNeedsBottomFiller = allowBottomFiller || Boolean(timelineBottomFiller);
            return (jsxRuntime.jsxs(protectedApi.ViewContainer, { viewSpec: viewSpec, attrs: {
                    role: getAriaTableRole(hasNesting),
                    'aria-rowcount': totalHeaderRowSpan + totalCnt,
                    'aria-colcount': colSpecs.length + 1,
                    'aria-label': props.labelStr,
                    'aria-labelledby': props.labelId,
                }, className: publicApi.joinClassNames(props.className, protectedApi.generateClassName(options.tableClass, {
                    borderlessX,
                    borderlessTop,
                    borderlessBottom,
                    multiMonthColumns: 0,
                }), classNames__default["default"].flexCol), children: [jsxRuntime.jsx(AriaProxyRows, { cellIdPrefix: cellIdPrefix, bodyRows: ariaBodyRows, resourceColCnt: colSpecs.length, superHeaderRowSpan: superHeaderRowSpan, hasNesting: hasNesting }), jsxRuntime.jsx(ResizableTwoCol, { initialStartWidthConfig: props.initialSpreadsheetWidthConfig, resizedWidthConfigRef: props.spreadsheetResizedWidthConfigRef, className: allowVerticalScrolling ? classNames__default["default"].liquid : '', 
                        /* spreadsheet
                        --------------------------------------------------------------------------------- */
                        startClassName: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].isolate), startContent: jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsxs("div", { role: "presentation", className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableHeaderClass, {
                                        isSticky: tableHeaderSticky,
                                        borderlessX,
                                        borderlessTop,
                                        borderlessBottom,
                                        multiMonthColumns: 0,
                                    }), classNames__default["default"].flexCol, tableHeaderSticky && classNames__default["default"].tableHeaderSticky, classNames__default["default"].z1), children: [jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].contentBox), style: {
                                                height: headerHeight,
                                            }, children: [Boolean(superHeaderRendering) && (jsxRuntime.jsx("div", { role: "presentation", className: publicApi.joinClassNames(options.resourceHeaderRowClass, classNames__default["default"].flexRow, classNames__default["default"].grow, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop), children: jsxRuntime.jsx(SuperHeaderCell, { cellIdPrefix: cellIdPrefix, cellRowIndex: 1, cellColIndex: 0, renderHooks: superHeaderRendering, indent: hasNesting && !groupColCnt /* group-cols are leftmost, making expander alignment irrelevant */, innerHeightRef: this.dataGridHeaderRowInnerHeightMap.createRef(true), colSpan: colSpecs.length, indentWidth: props.indentWidth }) })), jsxRuntime.jsx(protectedApi.Scroller, { horizontal: true, hideScrollbars: true, className: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].grow), ref: this.spreadsheetHeaderScrollerRef, children: jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].grow), style: { minWidth: spreadsheetCanvasWidth }, children: jsxRuntime.jsx("div", { role: "presentation", className: publicApi.joinClassNames(options.resourceHeaderRowClass, classNames__default["default"].flexRow, classNames__default["default"].grow, classNames__default["default"].borderless), children: jsxRuntime.jsx(HeaderCells, { colSpecs: colSpecs, colWidths: spreadsheetColWidths, indent: hasNesting, indentWidth: props.indentWidth, rowIndex: superHeaderRowSpan, cellIdPrefix: cellIdPrefix, 
                                                                // refs
                                                                innerHeightRef: this.dataGridHeaderRowInnerHeightMap.createRef(false), onColResize: props.onColResize }) }) }) })] }), jsxRuntime.jsx("div", { className: protectedApi.generateClassName(options.slotHeaderDividerClass, {
                                                inTableHeader: true,
                                                options: { dayMinWidth: options.dayMinWidth },
                                            }) })] }), jsxRuntime.jsxs(protectedApi.Scroller, { vertical: allowVerticalScrolling, horizontal: true, hideScrollbars: true, className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableBodyClass, {
                                        borderlessX,
                                        borderlessTop,
                                        borderlessBottom,
                                        multiMonthColumns: 0,
                                    }), classNames__default["default"].flexCol, classNames__default["default"].rel, // for Ruler.fillStart
                                    allowVerticalScrolling && classNames__default["default"].liquid, classNames__default["default"].z0), ref: this.spreadsheetBodyScrollerRef, clientWidthRef: this.handleSpreadsheetClientWidth, children: [jsxRuntime.jsx(BodySection, { cellIdPrefix: cellIdPrefix, inTreeGrid: hasNesting, groupRowPositions: groupRowPositions, resourceRowPositions: resourceRowPositions, groupColPositions: groupColPositions, displayedRowCnt: displayedRowCnt, groupCellCnts: flatGroupColLayouts.map((flatGroupCellLayouts) => flatGroupCellLayouts.length), colWidths: spreadsheetColWidths, colSpecs: colSpecs, rowInnerHeightRefMap: this.dataGridEntityInnerHeightMap, headerRowSpan: totalHeaderRowSpan, indentWidth: props.indentWidth, canvasWidth: spreadsheetCanvasWidth, canvasHeight: totalBodyHeight }), spreadsheetNeedsBottomFiller && (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.fillerClass, { inTableHeader: false }), classNames__default["default"].borderlessX, classNames__default["default"].borderlessBottom), style: { minHeight: spreadsheetBottomFiller } }))] }), jsxRuntime.jsx(protectedApi.FooterScrollbar, { isSticky: footerScrollbarSticky, canvasWidth: spreadsheetCanvasWidth, scrollerRef: this.spreadsheetFooterScrollerRef, scrollbarWidthRef: this.handleSpreadsheetBottomScrollbarWidth })] }), 
                        /* time-area (TODO: try to make this DRY-er with TimelineView???)
                        --------------------------------------------------------------------------------- */
                        endClassName: publicApi.joinClassNames(classNames__default["default"].flexCol, classNames__default["default"].isolate), endContent: jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableHeaderClass, {
                                        isSticky: tableHeaderSticky,
                                        borderlessX,
                                        borderlessTop,
                                        borderlessBottom,
                                        multiMonthColumns: 0,
                                    }), classNames__default["default"].flexCol, tableHeaderSticky && classNames__default["default"].tableHeaderSticky, classNames__default["default"].z1), children: [jsxRuntime.jsxs(protectedApi.Scroller, { ref: this.timeHeaderScrollerRef, horizontal: true, hideScrollbars: true, className: publicApi.joinClassNames(classNames__default["default"].flexRow, classNames__default["default"].contentBox), style: {
                                                height: headerHeight,
                                            }, children: [jsxRuntime.jsx("div", { role: "presentation", children: jsxRuntime.jsx("div", { ...buildAriaCellAttrs({
                                                            cellIdPrefix,
                                                            cellRowIndex: 1,
                                                            cellColIndex: colSpecs.length,
                                                        }), role: "columnheader", "aria-rowspan": totalHeaderRowSpan, className: classNames__default["default"].srOnly, children: options.eventsHint }) }), jsxRuntime.jsxs("div", { "aria-hidden": true, className: publicApi.joinClassNames(// TODO: DRY
                                                    classNames__default["default"].rel, // origin for now-indicator
                                                    classNames__default["default"].flexCol, timeCanvasWidth == null && classNames__default["default"].liquid, 
                                                    // slotLiquid:true implies that slots are expanding bigger than their min,
                                                    // and that there are NOT any horizontal scrollbars. if so, then no worries
                                                    // about sticky-event-titles. if so, we're able to apply cropping to prevent
                                                    // event hover-resizers and whatnot from bleeding out of the canvas and causing
                                                    // horizontal scrollbars when there normally wouldn't be any
                                                    props.slotLiquid && classNames__default["default"].crop), style: { minWidth: timeCanvasWidth }, children: [cellRows.map((cells, rowIndex) => {
                                                            const rowLevel = cellRows.length - rowIndex - 1;
                                                            const headerCellPositions = timeHeaderVirtualizers[rowIndex].computePositions(cells, virtualizationDisabled, forcedTimeScroll);
                                                            const shift = computeShift(headerCellPositions);
                                                            if (shift) {
                                                                timeHeaderVirtualizers[rowIndex].computePositions(cells, virtualizationDisabled, forcedTimeScroll);
                                                            }
                                                            return (jsxRuntime.jsx(TimelineHeaderRow, { className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].grow), dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, rowLevel: rowLevel, cells: cells, slotWidth: slotWidth, innerWidthRef: this.headerRowInnerWidthMap.createRef(rowIndex), innerHeighRef: this.timelineHeaderRowInnerHeightMap.createRef(rowIndex), insetInlineStart: shift && shift[0], width: shift ? (shift[1] - shift[0]) : undefined, cellStartIndex: shift && shift[2], cellCount: headerCellPositions.length }, rowIndex));
                                                        }), enableNowIndicator && (
                                                        // TODO: make this positioned WITHIN padding
                                                        jsxRuntime.jsx(TimelineNowIndicatorArrow, { tDateProfile: tDateProfile, nowMs: props.nowMs, slotWidth: slotWidth }))] }), Boolean(endScrollbarWidth) && (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.fillerClass, { inTableHeader: true }), classNames__default["default"].borderlessY, classNames__default["default"].borderlessEnd), style: { minWidth: endScrollbarWidth } }))] }), jsxRuntime.jsx("div", { className: protectedApi.generateClassName(options.slotHeaderDividerClass, {
                                                inTableHeader: false,
                                                options: { dayMinWidth: options.dayMinWidth },
                                            }) })] }), jsxRuntime.jsx(protectedApi.Scroller, { vertical: allowVerticalScrolling &&
                                        // infer whether scrolling would happen. prevents clientHeight thrashing due to horizontal scrollbars
                                        (totalBodyHeight != null && timeClientHeight != null && totalBodyHeight > timeClientHeight), horizontal: true, hideScrollbars: footerScrollbarSticky /* FYI, this view is never print */, className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableBodyClass, {
                                        borderlessX,
                                        borderlessTop,
                                        borderlessBottom,
                                        multiMonthColumns: 0,
                                    }), classNames__default["default"].flexCol, classNames__default["default"].rel, // for Ruler.fillStart
                                    allowVerticalScrolling && classNames__default["default"].liquid, classNames__default["default"].z0), ref: this.timeBodyScrollerRef, clientWidthRef: this.handleTimeClientWidth, clientHeightRef: allowVerticalScrolling
                                        ? this.handleTimeClientHeight
                                        : undefined // for when height:auto, which will have dynamic height and needlessly fire ResizeObserver
                                    , bottomScrollbarWidthRef: allowVerticalScrolling
                                        ? this.handleTimeBottomScrollbarWidth
                                        : undefined // for when height:auto, which will have dynamic height and needlessly fire ResizeObserver
                                    , children: jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, // origin for canvas?
                                        classNames__default["default"].grow, classNames__default["default"].flexCol, 
                                        // slotLiquid:true implies that slots are expanding bigger than their min,
                                        // and that there are NOT any horizontal scrollbars. if so, then no worries
                                        // about sticky-event-titles. if so, we're able to apply cropping to prevent
                                        // event hover-resizers and whatnot from bleeding out of the canvas and causing
                                        // horizontal scrollbars when there normally wouldn't be any
                                        props.slotLiquid && classNames__default["default"].crop), style: {
                                            minWidth: timeCanvasWidth,
                                            minHeight: totalBodyHeight,
                                        }, ref: this.handleBodyEl, children: [jsxRuntime.jsxs("div", { 
                                                // roving-origin for anything that fills y-axis,
                                                // like slots or non-resource bg events
                                                // is ZERO-width, but has defined top/bottom
                                                className: classNames__default["default"].abs, style: {
                                                    top: yFillTop,
                                                    height: yFillHeight,
                                                    bottom: yFillHeight == null ? 0 : undefined,
                                                    insetInlineStart: slotDateShift?.[0],
                                                }, children: [jsxRuntime.jsx(TimelineSlats, { dateProfile: dateProfile, tDateProfile: tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, slatStartIndex: slotDateShift?.[2], slatCount: slotDatePositions.length, slotWidth: slotWidth }), jsxRuntime.jsx(TimelineBg, { tDateProfile: tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, 
                                                        // content
                                                        bgEventSegs: bgSlicedProps.bgEventSegs, businessHourSegs: hasResourceBusinessHours ? null : bgSlicedProps.businessHourSegs, dateSelectionSegs: bgSlicedProps.dateSelectionSegs, eventResizeSegs: (bgSlicedProps.eventResize ? bgSlicedProps.eventResize.segs : null), 
                                                        // dimensions
                                                        slotWidth: props.slotWidth, 
                                                        // virtualization
                                                        clipStart: slotDateShift?.[0], clipEnd: slotDateShift?.[1] }), enableNowIndicator && (jsxRuntime.jsx(TimelineNowIndicatorLine, { tDateProfile: tDateProfile, nowMs: props.nowMs, slotWidth: slotWidth, clipStart: slotDateShift?.[0] }))] }), jsxRuntime.jsxs("div", { 
                                                // roving-origin for all types of resource(-group)-rows
                                                // is ZERO-height, always fixed to top, but has definet x-coordinate and width
                                                role: "presentation", className: classNames__default["default"].abs, style: {
                                                    top: 0,
                                                    insetInlineStart: slotDateShift?.[0],
                                                    width: slotDateShift ? (slotDateShift[1] - slotDateShift[0]) : undefined,
                                                }, children: [groupRowPositions.map((rowPosition) => {
                                                        const rowLayout = rowPosition.item;
                                                        const group = rowLayout.entity;
                                                        const groupKey = rowPosition.key;
                                                        return (jsxRuntime.jsx("div", { role: "presentation", className: publicApi.joinClassNames(classNames__default["default"].fillX, classNames__default["default"].flexRow), style: {
                                                                top: rowPosition.start,
                                                            }, children: jsxRuntime.jsx(GroupLane, { cellIdPrefix: cellIdPrefix, inTreeGrid: hasNesting, cellRowIndex: 1 + totalHeaderRowSpan + rowLayout.rowIndex, cellColIndex: colSpecs.length, group: group, borderBottom: rowLayout.visibleIndex < displayedRowCnt - 1, innerHeightRef: this.timeEntityInnerHeightMap.createRef(groupKey), height: rowPosition.size }) }, groupKey));
                                                    }), resourceRowPositions.map((rowPosition) => {
                                                        const resourceLayout = rowPosition.item;
                                                        const resource = resourceLayout.entity;
                                                        return (compat.createElement(ResourceLane, { ...splitProps[resource.id], key: resource.id /* TODO: use rowPosition.key? */, role: "presentation", cellIdPrefix: cellIdPrefix, inTreeGrid: hasNesting, cellRowIndex: 1 + totalHeaderRowSpan + resourceLayout.rowIndex, cellColIndex: colSpecs.length, className: classNames__default["default"].fillX, resource: resource, dateProfile: dateProfile, tDateProfile: tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, businessHours: resource.businessHours || fallbackBusinessHours, borderBottom: resourceLayout.visibleIndex < displayedRowCnt - 1, 
                                                            // ref
                                                            heightRef: this.timeEntityInnerHeightMap.createRef(resource.id), 
                                                            // dimensions
                                                            slotWidth: props.slotWidth, 
                                                            // position
                                                            top: rowPosition.start, height: rowPosition.size, 
                                                            // virtualization
                                                            clipStart: slotDateShift?.[0], clipEnd: slotDateShift?.[1] }));
                                                    })] }), timelineNeedsBottomFiller && (jsxRuntime.jsx("div", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.fillerClass, { inTableHeader: false }), classNames__default["default"].borderlessX, classNames__default["default"].borderlessBottom, classNames__default["default"].fillX), style: {
                                                    top: yFillBottom,
                                                    minHeight: timelineBottomFiller,
                                                } }))] }) }), Boolean(footerScrollbarSticky) && (jsxRuntime.jsx(protectedApi.FooterScrollbar, { isSticky: true, canvasWidth: timeCanvasWidth, scrollbarWidthRef: this.handleTimeBottomScrollbarWidth, scrollerRef: this.timeFooterScrollerRef })), jsxRuntime.jsx(protectedApi.Ruler, { widthRef: this.handleTimeTotalWidth })] }) })] }));
        }
        // Lifecycle
        // -----------------------------------------------------------------------------------------------
        componentDidMount() {
            const { props, context } = this;
            this._isUnmounting = false;
            this.timeScroller = new ScrollerSyncer(true); // horizontal=true
            this.bodyScroller = new ScrollerSyncer(); // horizontal=false
            this.spreadsheetScroller = new ScrollerSyncer(true); // horizontal=true
            this.updateScrollersSyncers();
            this.updateWindowScrolling();
            if (props.initialScroll) {
                this.scroll = { ...props.initialScroll }; // copy
                this.applyEntityScroll();
                this.applyTimeScroll();
            }
            else {
                this.resetTimeScroll();
            }
            this.timeScroller.addScrollListener(this.handleTimeScroll);
            this.timeScroller.addScrollEndListener(this.handleTimeScrollEnd);
            this.bodyScroller.addScrollStartListener(this.handleEntityScrollStart);
            this.bodyScroller.addScrollListener(this.handleEntityScroll);
            this.bodyScroller.addScrollEndListener(this.handleEntityScrollEnd);
            context.emitter.on('_timeScrollRequest', this.handleTimeScrollRequest);
            context.emitter.on('_resourceScrollRequest', this.handleResourceScrollRequest);
        }
        componentDidUpdate(prevProps, prevState) {
            const { props, state } = this;
            const { options } = this.context;
            this.updateScrollersSyncers();
            this.updateWindowScrolling();
            const dateProfileChange = prevProps.dateProfile !== props.dateProfile;
            const slotWidthChange = prevProps.slotWidth !== props.slotWidth;
            const timeCanvasWidthChange = prevProps.timeCanvasWidth !== props.timeCanvasWidth;
            const timeClientWidthChange = prevState.timeClientWidth !== state.timeClientWidth;
            if (dateProfileChange || slotWidthChange || timeCanvasWidthChange || timeClientWidthChange) {
                if (dateProfileChange && options.scrollTimeReset) {
                    this.resetTimeScroll();
                }
                else {
                    this.applyTimeScroll();
                }
            }
            /*
            Unfortunately this will execute after auto-scroll finished but before scrollEnd can record
            the updated scroll positioning, causing a scroll-jump to the last recorded entityScroll.
            */
            if (this.queuedEntityScroll) {
                // console.log('queuedEntityScroll!')
                this.queuedEntityScroll = false;
                this.applyEntityScroll();
            }
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.slotInnerWidth = undefined;
            this.timeScroller.destroy();
            this.bodyScroller.destroy();
            this.spreadsheetScroller.destroy();
            this.destroyWindowScrolling();
            this.bodyScroller.removeScrollEndListener(this.handleEntityScrollEnd);
            this.bodyScroller.removeScrollListener(this.handleEntityScroll);
            this.context.emitter.off('_timeScrollRequest', this.handleTimeScrollRequest);
            this.context.emitter.off('_resourceScrollRequest', this.handleResourceScrollRequest);
        }
        // Virtualizer Utils
        // -----------------------------------------------------------------------------------------------
        setVirtualizerViewportSize(height) {
            this.rowVirtualizer.handleViewportSize(height);
            for (const groupColVirtualizer of this.groupColVirtualizers) {
                groupColVirtualizer.handleViewportSize(height);
            }
        }
        handleAnyEntityScroll(scroll) {
            this.currentEntityScroll = scroll;
            this.updateVirtualizerScroll();
        }
        updateWindowScrolling() {
            if (protectedApi.getIsHeightAuto(this.context.options)) {
                if (!this.isTrackingWindowScroll) {
                    this.isTrackingWindowScroll = true;
                    this.setVirtualizerViewportSize(window.innerHeight);
                    ([this.handleWindowResize, this.cancelWindowResize] = protectedApi.debounce(() => {
                        this.setVirtualizerViewportSize(window.innerHeight);
                    }, 200));
                    window.addEventListener('resize', this.handleWindowResize);
                    window.addEventListener('scroll', this.handleWindowScroll, { passive: true });
                }
            }
            else {
                this.destroyWindowScrolling();
            }
        }
        destroyWindowScrolling() {
            if (this.isTrackingWindowScroll) {
                this.isTrackingWindowScroll = false;
                this.cancelWindowResize();
                window.removeEventListener('resize', this.handleWindowResize);
                window.removeEventListener('scroll', this.handleWindowScroll, { passive: true });
            }
        }
        // Scrolling
        // -----------------------------------------------------------------------------------------------
        updateScrollersSyncers() {
            this.timeScroller.handleChildren([
                this.timeHeaderScrollerRef.current,
                this.timeBodyScrollerRef.current,
                this.timeFooterScrollerRef.current,
            ]);
            this.bodyScroller.handleChildren([
                this.spreadsheetBodyScrollerRef.current,
                this.timeBodyScrollerRef.current,
            ]);
            this.spreadsheetScroller.handleChildren([
                this.spreadsheetHeaderScrollerRef.current,
                this.spreadsheetBodyScrollerRef.current,
                this.spreadsheetFooterScrollerRef.current,
            ]);
        }
        // TIME Scrolling
        // -----------------------------------------------------------------------------------------------
        resetTimeScroll() {
            this.handleTimeScrollRequest(this.context.options.scrollTime);
        }
        applyTimeScroll() {
            const x = this.computeTimeScroll();
            if (x !== undefined) {
                this.timeScroller.scrollTo({ x });
                if (this.scroll.x !== x) {
                    this.scroll.x = x;
                    protectedApi.setRef(this.props.scrollRef, this.scroll);
                }
            }
        }
        // used by render() for virtualization too
        computeTimeScroll() {
            const { props, context, scroll } = this;
            const { tDateProfile } = props;
            const slotWidth = props.slotWidth ?? ESTIMATED_SLOT_WIDTH;
            let { x, time } = scroll;
            if (time) {
                x = timeToCoord(time, context.dateEnv, props.dateProfile, tDateProfile, slotWidth);
                if (x) {
                    x += 1; // overcome border. TODO: DRY this up
                }
            }
            if (x !== undefined && this.maxHScroll !== undefined) {
                x = Math.min(this.maxHScroll, x);
            }
            return x;
        }
        // ENTITY (RESOURCE) Scrolling
        // -----------------------------------------------------------------------------------------------
        // Assumes unmeasured rows are as tall as the median of the rows measured most recently, so that
        // the scroll height stays stable when rows are alike, and a scrollbar drag can track the pointer.
        // Doesn't change during a scroll, when it would move rows that scrollSlack doesn't account for.
        // Doesn't change when the window scrolls, because the anchoring below only works on bodyScroller.
        updateEstimatedRowHeight() {
            const { recentlyMeasuredRowKeys } = this;
            const { options } = this.context;
            if (options.virtualization &&
                !protectedApi.getIsHeightAuto(options) &&
                !this.isScrolling &&
                recentlyMeasuredRowKeys.length) {
                const sortedHeights = recentlyMeasuredRowKeys.map((key) => Math.max(this.dataGridEntityInnerHeightMap.current.get(key), this.timeEntityInnerHeightMap.current.get(key) || 0)).sort((a, b) => a - b);
                const estimatedRowHeight = sortedHeights[sortedHeights.length >> 1];
                if (estimatedRowHeight !== this.estimatedRowHeight) {
                    this.estimatedRowHeight = estimatedRowHeight;
                    this.queuedEntityScroll = true; // keep the current row in place
                }
            }
        }
        isCutShortEntityScroll(y) {
            return this.cutShortEntityScrollY !== undefined &&
                Math.abs(y - this.cutShortEntityScrollY) < 1;
        }
        // returns whether applied
        applyEntityScroll() {
            const requestedScrollTop = this.computeRequestedEntityScroll();
            if (requestedScrollTop !== undefined) {
                const scrollTop = Math.min(this.maxVScroll, requestedScrollTop);
                // maxVScroll comes from the row heights known at render, which estimate rows not measured yet,
                // such as rows just added. If it cuts the scroll short, the scroll events this causes are the
                // layout's own: keep the anchor through them, and apply it again once more rows are measured.
                // See handleEntityScrollStart and handleEntityScrollEnd
                this.cutShortEntityScrollY = scrollTop < requestedScrollTop ? scrollTop : undefined;
                this.bodyScroller.scrollTo({ y: scrollTop });
                return true;
            }
            this.cutShortEntityScrollY = undefined;
            return false;
        }
        computeEntityScroll() {
            const requestedScrollTop = this.computeRequestedEntityScroll();
            if (requestedScrollTop !== undefined) {
                return Math.min(this.maxVScroll, requestedScrollTop);
            }
        }
        // where the anchor wants the scroll, before clamping to maxVScroll
        computeRequestedEntityScroll() {
            const { bodyTops, bodyHeights, scroll } = this;
            const { entityId, fromBottom } = scroll;
            if (entityId) {
                const top = bodyTops.get(entityId);
                const height = bodyHeights.get(entityId);
                if (top != null) {
                    const bottom = top + height;
                    return fromBottom != null ?
                        bottom - fromBottom : // pixels from bottom edge
                        top + // just use top edge
                            (top ? 1 : 0); // overcome top border
                }
            }
        }
        prepareHits() {
            /*
            HACK for queuedHeightChange usage in componentDidUpdate
            This executes when a drag/resize starts and clears the last recorded entity scroll
            */
            this.scroll.entityId = undefined;
            this.scroll.fromBottom = undefined;
            this.cutShortEntityScrollY = undefined;
        }
        queryHit(isRtl, positionLeft, positionTop) {
            let { props, context, bodyLayouts, bodyTops, bodyHeights } = this;
            const { dateProfile, tDateProfile, timeCanvasWidth } = props;
            const slotWidth = props.slotWidth ?? ESTIMATED_SLOT_WIDTH;
            const { dateEnv } = context;
            let coordRes = findEntityByCoord(bodyLayouts, bodyTops, bodyHeights, positionTop, createEntityId);
            if (coordRes) {
                let [entityAtTop, top, height] = coordRes;
                if (!isEntityGroup(entityAtTop)) {
                    let resource = entityAtTop;
                    let bottom = top + height;
                    const hitData = computeTimelineHitData(positionLeft, timeCanvasWidth, slotWidth, isRtl, tDateProfile, dateEnv);
                    if (!hitData) { // in the dead tail of a DST-truncated slot
                        return null;
                    }
                    return {
                        dateProfile,
                        dateSpan: {
                            ...hitData.dateSpan,
                            resourceId: resource.id,
                        },
                        rect: {
                            ...hitData.rect,
                            top,
                            bottom,
                        },
                        getDayEl: () => getTimelineSlotEl(this.bodyEl, hitData.slatIndex),
                        layer: 0,
                    };
                }
            }
            return null;
        }
    }

    /*
    TODO: test multiple levels of group-col nesting
    */
    function buildPrintLayouts(hierarchy, hasNesting, expansions, expansionDefault) {
        const layouts = [];
        function processNodes(nodes, indent, colGroups) {
            for (const node of nodes) {
                if (node.resourceFields) { // resource
                    const isExpanded = expansions[node.entity.id] ?? expansionDefault;
                    const hasChildren = Boolean(node.children.length);
                    layouts.push({
                        type: 'resource',
                        entity: node.entity,
                        resourceFields: node.resourceFields,
                        colGroups,
                        isExpanded,
                        hasChildren,
                        indent,
                    });
                    processNodes(node.children, indent + 1, colGroups);
                }
                else if (node.pooledHeight) { // column-group
                    processNodes(node.children, indent, colGroups.concat(node.entity));
                }
                else { // row-group (FYI, can't be within a column-group)
                    const isExpanded = expansions[createGroupId(node.entity)] ?? expansionDefault;
                    const hasChildren = Boolean(node.children.length);
                    layouts.push({
                        type: 'group',
                        entity: node.entity,
                        isExpanded,
                        hasChildren,
                        indent,
                    });
                    processNodes(node.children, indent + 1, colGroups);
                }
            }
        }
        processNodes(hierarchy, hasNesting ? 1 : 0, []);
        return layouts;
    }
    // Computes real table row spans after print truncation so spans never extend past a rendered row.
    function buildPrintTableRows(layouts, groupColCnt) {
        const rows = layouts.map((layout) => layout.type === 'resource' ? {
            ...layout,
            colGroupCells: Array.from({ length: groupColCnt }, () => null),
        } : layout);
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const row = rows[rowIndex];
            if (row.type !== 'resource') {
                continue;
            }
            for (let colIndex = 0; colIndex < groupColCnt; colIndex += 1) {
                const group = row.colGroups[colIndex];
                const prevRow = rows[rowIndex - 1];
                if (!group ||
                    (prevRow?.type === 'resource' && prevRow.colGroups[colIndex] === group)) {
                    continue;
                }
                let rowSpan = 1;
                while (rowIndex + rowSpan < rows.length) {
                    const nextRow = rows[rowIndex + rowSpan];
                    if (nextRow.type !== 'resource' || nextRow.colGroups[colIndex] !== group) {
                        break;
                    }
                    rowSpan += 1;
                }
                row.colGroupCells[colIndex] = {
                    group,
                    rowSpan,
                };
            }
        }
        return rows;
    }

    /** Renders one logical resource row whose Timeline bands can fragment across print pages. */
    class ResourcePrintRow extends TimelinePrintRenderer {
        constructor() {
            super(...arguments);
            // memo
            this.refineRenderProps = protectedApi.memoizeObjArg(refineResourceLaneRenderProps);
            this.buildDateSpanProps = protectedApi.memoize(buildResourceDateSpanProps);
            this.buildEventRenderProps = protectedApi.memoize(buildResourceEventRenderProps);
            // internal
            this.slicer = new TimelineLaneSlicer();
        }
        render() {
            const { props, context } = this;
            const { options } = context;
            const { layout } = props;
            const { entity: resource } = layout;
            const renderProps = this.refineRenderProps({
                resource,
                context,
                eventOverlap: Boolean(options.eventOverlap),
            });
            const eventRenderProps = this.buildEventRenderProps(renderProps.resource);
            const resourceLaneClassName = protectedApi.generateClassName(options.resourceLaneClass, renderProps);
            const slicedProps = this.slicer.sliceProps(props, props.dateProfile, props.tDateProfile.isTimeScale ? null : options.nextDayThreshold, context, props.dateProfile, context.dateProfileGenerator, props.tDateProfile, context.dateEnv);
            const { eventBands, moreLinkBand } = this.buildPrintBands(slicedProps.fgEventSegs, props.tDateProfile, props.slotWidth);
            const timelineBandProps = {
                dateProfile: props.dateProfile,
                tDateProfile: props.tDateProfile,
                nowDate: props.nowDate,
                nowMs: props.nowMs,
                todayRange: props.todayRange,
                eventSelection: slicedProps.eventSelection,
                dateSpanProps: this.buildDateSpanProps(resource.id),
                renderProps: eventRenderProps,
                timeCanvasClipStart: props.timeCanvasClipStart,
            };
            return (jsxRuntime.jsxs("tr", { children: [layout.colGroupCells.map((cell, colIndex) => cell && (jsxRuntime.jsx(ResourceGroupCell, { colSpec: cell.group.spec, fieldValue: cell.group.value, rowSpan: cell.rowSpan, borderStart: Boolean(colIndex), borderBottom: props.rowIndex + cell.rowSpan < props.rowCount, forPrint: true }, colIndex))), props.colSpecs.slice(props.groupColCnt).map((colSpec, colIndex0) => {
                        const colIndex = props.groupColCnt + colIndex0;
                        const fieldValue = colSpec.field
                            ? layout.resourceFields[colSpec.field]
                            : (resource.title || getPublicId(resource.id));
                        return (jsxRuntime.jsx(ResourceCell, { colSpec: colSpec, resource: resource, field: colSpec.field || 'title', fieldValue: fieldValue, indent: layout.indent, hasChildren: layout.hasChildren, isExpanded: layout.isExpanded, width: undefined, indentWidth: props.indentWidth, borderStart: Boolean(colIndex), borderBottom: props.isNotLast, forPrint: true }, colIndex));
                    }), jsxRuntime.jsx("td", { className: publicApi.joinClassNames(options.resourceColumnDividerClass) }), jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "td", attrs: {
                            'data-resource-id': resource.id,
                        }, className: publicApi.joinClassNames(resourceLaneClassName, options.resourceRowClass, classNames__default["default"].noMargin, classNames__default["default"].noPadding, classNames__default["default"].contentBox, classNames__default["default"].borderlessX, classNames__default["default"].borderlessTop, !props.isNotLast && classNames__default["default"].borderlessBottom), renderProps: renderProps, generatorName: undefined, didMount: options.resourceLaneDidMount, willUnmount: options.resourceLaneWillUnmount, children: () => (jsxRuntime.jsxs("div", { className: classNames__default["default"].rel, children: [jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].fill, classNames__default["default"].crop), children: jsxRuntime.jsx(TimelineBg, { tDateProfile: props.tDateProfile, nowDate: props.nowDate, nowMs: props.nowMs, todayRange: props.todayRange, bgEventSegs: slicedProps.bgEventSegs, businessHourSegs: slicedProps.businessHourSegs, dateSelectionSegs: null, eventResizeSegs: null, renderProps: eventRenderProps, slotWidth: props.slotWidth, clipStart: props.timeCanvasClipStart }) }), jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "div", className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noShrink), renderProps: renderProps, generatorName: "resourceLaneTopContent", customGenerator: options.resourceLaneTopContent, classNameGenerator: options.resourceLaneTopClass }), eventBands.map((band) => (compat.createElement(TimelinePrintEventBand, { ...timelineBandProps, key: band.levelIndex, band: band, heightRefMap: this.printHeights.segHeightRefMap }))), moreLinkBand && (jsxRuntime.jsx(TimelinePrintMoreLinkBand, { ...timelineBandProps, band: moreLinkBand, heightRefMap: this.printHeights.moreLinkHeightRefMap })), jsxRuntime.jsx(protectedApi.ContentContainer, { tag: "div", className: publicApi.joinClassNames(classNames__default["default"].noMargin, classNames__default["default"].noShrink), renderProps: renderProps, generatorName: "resourceLaneBottomContent", customGenerator: options.resourceLaneBottomContent, classNameGenerator: options.resourceLaneBottomClass })] })) })] }));
        }
    }

    class ResourceTimelineLayoutPrint extends protectedApi.BaseComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memoized
            this.buildPrintLayouts = protectedApi.memoize(buildPrintLayouts);
            this.buildPrintTableRows = protectedApi.memoize(buildPrintTableRows);
            // handlers
            this.handleHeaderRowHeightChange = () => {
                if (!this._isUnmounting) {
                    protectedApi.afterSize(this.boundForceUpdate);
                }
            };
            this.boundForceUpdate = () => {
                if (!this._isUnmounting) {
                    this.forceUpdate();
                }
            };
            // refs
            this.headerElRef = compat.createRef();
            this.dividerProbeElRef = compat.createRef();
            this.timelineHeaderRowInnerHeightMap = new protectedApi.RefMap(this.handleHeaderRowHeightChange);
            this.dataGridHeaderRowInnerHeightMap = new protectedApi.RefMap(this.handleHeaderRowHeightChange);
        }
        render() {
            let { props, context, dataGridHeaderRowInnerHeightMap, timelineHeaderRowInnerHeightMap, } = this;
            let { dateProfile } = props;
            let { options, viewSpec } = context;
            const { borderlessX, borderlessTop, borderlessBottom } = protectedApi.computeViewBorderless(options);
            const { tDateProfile, todayRange, nowDate, hasNesting } = props;
            const { slotWidth, timeCanvasWidth } = props;
            const { splitProps, bgSlicedProps, timeCanvasClipStart } = props;
            const { superHeaderRendering, groupColCnt, colSpecs } = props;
            const { cellRows } = tDateProfile;
            const headerContentHeight = computeResourceTimelineHeaderHeight(dataGridHeaderRowInnerHeightMap.current, timelineHeaderRowInnerHeightMap.current, Boolean(superHeaderRendering), cellRows.length);
            const tableDisplayInfo = {
                borderlessX,
                borderlessTop,
                borderlessBottom,
                multiMonthColumns: 0,
            };
            const headerDividerClassName = protectedApi.generateClassName(options.slotHeaderDividerClass, {
                inTableHeader: true,
                options: { dayMinWidth: options.dayMinWidth },
            });
            const { resourceHierarchy } = props;
            let printLayouts = this.buildPrintLayouts(resourceHierarchy, hasNesting, props.resourceEntityExpansions, options.resourcesInitiallyExpanded);
            if (printLayouts.length > options.printMaxRows) {
                printLayouts = printLayouts.slice(0, options.printMaxRows);
                protectedApi.warn(`Rows truncated for print. Only included the first ${options.printMaxRows} rows.`);
            }
            const printRows = this.buildPrintTableRows(printLayouts, groupColCnt);
            const resourceColWidths = computeResourceColWidths(props.spreadsheetWidthConfig, props.spreadsheetColWidths, colSpecs.length);
            const dividerWidth = this.state.dividerWidth ?? 0;
            const timelineViewportInsetStart = serializeDimConfig({
                pixels: props.spreadsheetWidthConfig.pixels + dividerWidth,
                frac: props.spreadsheetWidthConfig.frac,
            });
            const timelineHeaderCell = (jsxRuntime.jsx("th", { rowSpan: superHeaderRendering ? 2 : undefined, className: publicApi.joinClassNames(classNames__default["default"].noPadding, classNames__default["default"].borderless, classNames__default["default"].crop), children: jsxRuntime.jsx("div", { className: publicApi.joinClassNames(classNames__default["default"].rel, classNames__default["default"].flexCol), style: {
                        width: timeCanvasWidth,
                        height: headerContentHeight,
                        insetInlineStart: -timeCanvasClipStart,
                    }, children: cellRows.map((cells, rowIndex) => {
                        const rowLevel = cellRows.length - rowIndex - 1;
                        return (jsxRuntime.jsx(TimelineHeaderRow, { className: classNames__default["default"].grow, dateProfile: props.dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, rowLevel: rowLevel, cells: cells, slotWidth: slotWidth, innerHeighRef: this.timelineHeaderRowInnerHeightMap.createRef(rowIndex) }, rowLevel));
                    }) }) }));
            const headerDividerCell = (jsxRuntime.jsx("th", { rowSpan: superHeaderRendering ? 2 : undefined, className: publicApi.joinClassNames(options.resourceColumnDividerClass) }));
            return (jsxRuntime.jsxs(protectedApi.ViewContainer, { viewSpec: viewSpec, className: publicApi.joinClassNames(props.className, classNames__default["default"].rel, classNames__default["default"].crop, classNames__default["default"].isolate), children: [jsxRuntime.jsx("div", { ref: this.dividerProbeElRef, className: publicApi.joinClassNames(options.resourceColumnDividerClass, classNames__default["default"].offscreen) }), jsxRuntime.jsxs("div", { className: publicApi.joinClassNames(classNames__default["default"].abs, classNames__default["default"].crop, classNames__default["default"].end0, classNames__default["default"].pointerEventsNone, classNames__default["default"].z0), style: {
                            top: this.state.headerHeight ?? 0,
                            // Compensates for Firefox miscomputing absolute height with repeated print headers.
                            bottom: '-5%',
                            insetInlineStart: timelineViewportInsetStart,
                        }, children: [jsxRuntime.jsx(TimelineSlats, { dateProfile: dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, slotWidth: slotWidth, clipStart: timeCanvasClipStart }), jsxRuntime.jsx(TimelineBg, { tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, bgEventSegs: bgSlicedProps.bgEventSegs, businessHourSegs: props.hasResourceBusinessHours
                                    ? null
                                    : bgSlicedProps.businessHourSegs, dateSelectionSegs: null, eventResizeSegs: null, slotWidth: slotWidth, clipStart: timeCanvasClipStart })] }), jsxRuntime.jsxs("table", { className: publicApi.joinClassNames(protectedApi.generateClassName(options.tableClass, tableDisplayInfo), classNames__default["default"].printTable, classNames__default["default"].rel, classNames__default["default"].z1), children: [jsxRuntime.jsxs("colgroup", { children: [colSpecs.map((_colSpec, colIndex) => (jsxRuntime.jsx("col", { style: { width: resourceColWidths?.[colIndex] } }, colIndex))), jsxRuntime.jsx("col", { style: { width: this.state.dividerWidth } }), jsxRuntime.jsx("col", {})] }), jsxRuntime.jsxs("thead", { ref: this.headerElRef, className: protectedApi.generateClassName(options.tableHeaderClass, {
                                    ...tableDisplayInfo,
                                    isSticky: false,
                                }), children: [superHeaderRendering ? (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsxs("tr", { children: [jsxRuntime.jsx(SuperHeaderCell, { renderHooks: superHeaderRendering, indent: hasNesting && !groupColCnt /* group-cols are leftmost, making expander alignment irrelevant */, colSpan: colSpecs.length, indentWidth: props.indentWidth, innerHeightRef: this.dataGridHeaderRowInnerHeightMap.createRef(true), forPrint: true }), headerDividerCell, timelineHeaderCell] }), jsxRuntime.jsx("tr", { children: jsxRuntime.jsx(HeaderCells, { colSpecs: colSpecs, colWidths: undefined, indent: hasNesting, indentWidth: props.indentWidth, innerHeightRef: this.dataGridHeaderRowInnerHeightMap.createRef(false), forPrint: true }) })] })) : (jsxRuntime.jsxs("tr", { children: [jsxRuntime.jsx(HeaderCells, { colSpecs: colSpecs, colWidths: undefined, indent: hasNesting, indentWidth: props.indentWidth, innerHeightRef: this.dataGridHeaderRowInnerHeightMap.createRef(false), forPrint: true }), headerDividerCell, timelineHeaderCell] })), jsxRuntime.jsxs("tr", { children: [jsxRuntime.jsx("th", { colSpan: colSpecs.length, className: publicApi.joinClassNames(classNames__default["default"].noPadding, headerDividerClassName) }), jsxRuntime.jsx("th", { className: publicApi.joinClassNames(options.resourceColumnDividerClass, classNames__default["default"].noPaddingY) }), jsxRuntime.jsx("th", { className: publicApi.joinClassNames(classNames__default["default"].noPadding, headerDividerClassName) })] })] }), jsxRuntime.jsx("tbody", { className: protectedApi.generateClassName(options.tableBodyClass, tableDisplayInfo), children: printRows.map((printRow, rowIndex0) => {
                                    const isNotLast = rowIndex0 < printRows.length - 1;
                                    if (printRow.type === 'resource') {
                                        const resource = printRow.entity;
                                        return (compat.createElement(ResourcePrintRow, { ...splitProps[resource.id], key: resource.id, layout: printRow, rowIndex: rowIndex0, rowCount: printRows.length, isNotLast: isNotLast, dateProfile: dateProfile, tDateProfile: tDateProfile, nowDate: nowDate, nowMs: props.nowMs, todayRange: todayRange, colSpecs: colSpecs, groupColCnt: groupColCnt, timeCanvasClipStart: timeCanvasClipStart, slotWidth: slotWidth, indentWidth: props.indentWidth, businessHours: props.hasResourceBusinessHours
                                                ? splitProps[resource.id].businessHours
                                                : null, dateSelection: null, eventDrag: null, eventResize: null }));
                                    }
                                    else {
                                        const group = printRow.entity;
                                        const groupKey = createGroupId(group);
                                        return (jsxRuntime.jsxs("tr", { className: classNames__default["default"].breakInsideAvoid, children: [jsxRuntime.jsx(ResourceGroupHeaderCell, { group: group, isExpanded: printRow.isExpanded, colSpan: props.colSpecs.length, borderBottom: isNotLast, indentWidth: props.indentWidth, forPrint: true }), jsxRuntime.jsx("td", { className: publicApi.joinClassNames(options.resourceColumnDividerClass) }), jsxRuntime.jsx(GroupLane, { group: group, borderBottom: isNotLast, forPrint: true })] }, groupKey));
                                    }
                                }) })] })] }));
        }
        componentDidMount() {
            this._isUnmounting = false;
            this.disconnectHeaderHeight = protectedApi.watchHeight(this.headerElRef.current, (headerHeight) => {
                if (!this._isUnmounting && headerHeight !== this.state.headerHeight) {
                    this.setState({ headerHeight });
                }
            });
            this.disconnectDividerWidth = protectedApi.watchWidth(this.dividerProbeElRef.current, (dividerWidth) => {
                if (!this._isUnmounting && dividerWidth !== this.state.dividerWidth) {
                    this.setState({ dividerWidth });
                }
            });
        }
        componentWillUnmount() {
            this._isUnmounting = true;
            this.disconnectHeaderHeight?.();
            this.disconnectDividerWidth?.();
        }
    }
    function computeResourceColWidths(totalConfig, pixelWidths, colCnt) {
        let ratios;
        if (pixelWidths) {
            const pixelTotal = pixelWidths.reduce((total, width) => total + width, 0);
            if (pixelTotal) {
                ratios = pixelWidths.map((width) => width / pixelTotal);
            }
        }
        // Use equal proportions when screen-resolved column widths are not yet available.
        ratios ?? (ratios = Array.from({ length: colCnt }, () => 1 / colCnt));
        return ratios.map((ratio) => serializeDimConfig({
            pixels: totalConfig.pixels * ratio,
            frac: totalConfig.frac * ratio,
        }));
    }

    const SPREADSHEET_COL_MIN_WIDTH = 50;
    function processColOptions(options) {
        let allColSpecs = options.resourceColumns || [];
        let superHeaderRendering = null;
        if (!allColSpecs.length) {
            allColSpecs.push({
                headerDefault: () => 'Resources', // TODO: view.defaults
            });
        }
        else if (options.resourceColumnHeaderContent) { // weird way to determine if content
            superHeaderRendering = {
                headerClass: options.resourceColumnHeaderClass,
                headerInnerClass: options.resourceColumnHeaderInnerClass,
                headerContent: options.resourceColumnHeaderContent,
                headerDidMount: options.resourceColumnHeaderDidMount,
                headerWillUnmount: options.resourceColumnHeaderWillUnmount,
            };
        }
        let resourceColSpecs = [];
        let groupColSpecs = []; // part of the colSpecs, but filtered out in order to put first
        let groupSpecs = [];
        let groupRowDepth = 0;
        let foundMainColSpec = false;
        for (let colSpec of allColSpecs) {
            (colSpec.group ? groupColSpecs : resourceColSpecs).push({
                ...colSpec,
                isMain: ((!colSpec.group && !foundMainColSpec)
                    ? (foundMainColSpec = true)
                    : false),
                headerClass: protectedApi.joinFuncishClassNames(options.resourceColumnHeaderClass, colSpec.headerClass, 'resourceColumnHeaderClass'),
                headerInnerClass: protectedApi.joinFuncishClassNames(options.resourceColumnHeaderInnerClass, colSpec.headerInnerClass, 'resourceColumnHeaderInnerClass'),
                headerResizerClass: protectedApi.joinFuncishClassNames(options.resourceColumnResizerClass, colSpec.headerResizerClass, 'resourceColumnResizerClass'),
                headerContent: protectedApi.mergeContentInjectors(options.resourceColumnHeaderContent, colSpec.headerContent),
                headerDidMount: protectedApi.mergeLifecycleCallbacks(options.resourceColumnHeaderDidMount, colSpec.headerDidMount),
                headerWillUnmount: protectedApi.mergeLifecycleCallbacks(options.resourceColumnHeaderWillUnmount, colSpec.headerWillUnmount),
                cellClass: protectedApi.joinFuncishClassNames(options.resourceCellClass, colSpec.cellClass, 'resourceCellClass'),
                cellInnerClass: protectedApi.joinFuncishClassNames(options.resourceCellInnerClass, colSpec.cellInnerClass, 'resourceCellInnerClass'),
                cellContent: protectedApi.mergeContentInjectors(options.resourceCellContent, colSpec.cellContent),
                cellDidMount: protectedApi.mergeLifecycleCallbacks(options.resourceCellDidMount, colSpec.cellDidMount),
                cellWillUnmount: protectedApi.mergeLifecycleCallbacks(options.resourceCellWillUnmount, colSpec.cellWillUnmount),
            });
        }
        if (groupColSpecs.length) {
            groupSpecs = groupColSpecs;
        }
        else {
            groupRowDepth = 1;
            let hGroupField = options.resourceGroupField;
            if (hGroupField) {
                groupSpecs.push({
                    field: hGroupField,
                    labelClass: options.resourceGroupHeaderClass,
                    labelInnerClass: options.resourceGroupHeaderInnerClass,
                    labelContent: options.resourceGroupHeaderContent,
                    labelDidMount: options.resourceGroupHeaderDidMount,
                    labelWillUnmount: options.resourceGroupHeaderWillUnmount,
                    laneClass: options.resourceGroupLaneClass,
                    laneInnerClass: options.resourceGroupLaneInnerClass,
                    laneContent: options.resourceGroupLaneContent,
                    laneDidMount: options.resourceGroupLaneDidMount,
                    laneWillUnmount: options.resourceGroupLaneWillUnmount,
                });
            }
        }
        let allOrderSpecs = options.resourceOrder || DEFAULT_RESOURCE_ORDER;
        let plainOrderSpecs = [];
        for (let orderSpec of allOrderSpecs) {
            let isGroup = false;
            for (let groupSpec of groupSpecs) {
                if (groupSpec.field === orderSpec.field) {
                    groupSpec.order = orderSpec.order; // -1, 0, 1
                    isGroup = true;
                    break;
                }
            }
            if (!isGroup) {
                plainOrderSpecs.push(orderSpec);
            }
        }
        const colSpecs = groupColSpecs.concat(resourceColSpecs);
        const colWidthConfigs = colSpecs.map((colSpec) => (toSiblingDimConfig(parseDimOption(colSpec.width, SPREADSHEET_COL_MIN_WIDTH, 'resource column `width`', 'The column grows to fill the space instead.'), 
        /* grow = */ undefined, SPREADSHEET_COL_MIN_WIDTH)));
        ensureDimConfigsGrow(colWidthConfigs);
        return {
            groupSpecs,
            groupRowDepth,
            orderSpecs: plainOrderSpecs,
            colSpecs,
            groupColCnt: groupColSpecs.length,
            colWidthConfigs,
            superHeaderRendering,
        };
    }
    /*
    Only a number, px or % parses. Anything else warns, naming the option and what happens instead
    */
    function parseDimOption(input, minDim, name, fallback) {
        const dimConfig = parseDimConfig(input, minDim);
        if (input != null && !dimConfig) {
            protectedApi.warn(`Invalid ${name}: ${JSON.stringify(input)}. Expected a number, or a string in px or %. ${fallback}`);
        }
        return dimConfig;
    }

    const MIN_RESOURCE_AREA_WIDTH = 30; // definitely bigger than scrollbars
    const DEFAULT_RESOURCE_COLUMNS_WIDTH = '30%';
    class ResourceTimelineView extends protectedApi.DateComponent {
        constructor() {
            super(...arguments);
            this.state = {};
            // memoized
            this.buildTimelineDateProfile = protectedApi.memoize(buildTimelineDateProfile);
            this.filterResourceStore = protectedApi.memoize(filterResourceStore);
            this.processColOptions = protectedApi.memoize(processColOptions);
            this.parseResourceColumnsWidth = protectedApi.memoize(parseResourceColumnsWidth);
            this.buildResourceHierarchy = protectedApi.memoize(buildResourceHierarchy);
            this.computeSlotWidth = protectedApi.memoize(computeSlotWidth);
            this.computeHasNesting = protectedApi.memoize(computeHasNesting);
            this.computeHasResourceBusinessHours = protectedApi.memoize(computeHasResourceBusinessHours);
            // ref
            this.scrollRef = compat.createRef();
            this.spreadsheetResizedWidthConfigRef = compat.createRef();
            this.resourceSplitter = new ResourceSplitter();
            this.bgSlicer = new TimelineLaneSlicer();
            this.handleColResize = (colIndex, newWidth) => {
                if (this._isUnmounting)
                    return;
                const colWidthOverrides = resizeSiblingDimConfig(this.spreadsheetColWidthConfigs, this.spreadsheetColWidths, this.state.spreadsheetClientWidth, colIndex, newWidth);
                this.setState({ colWidthOverrides });
            };
            this.handleSpreadsheetClientWidth = (spreadsheetClientWidth) => {
                if (this._isUnmounting)
                    return;
                if (spreadsheetClientWidth != null) {
                    this.setState({ spreadsheetClientWidth });
                }
            };
            this.handleTimeClientWidth = (timeClientWidth) => {
                if (this._isUnmounting)
                    return;
                if (timeClientWidth != null) {
                    this.setState({ timeClientWidth });
                }
            };
            this.handleSlotInnerWidth = (slotInnerWidth) => {
                if (this._isUnmounting)
                    return;
                if (slotInnerWidth != null) {
                    this.setState({ slotInnerWidth });
                }
            };
            this.handleExpanderEl = (expanderEl) => {
                if (this.disconnectExpanderWidth) {
                    this.disconnectExpanderWidth();
                    this.disconnectExpanderWidth = undefined;
                }
                if (expanderEl) {
                    this.disconnectExpanderWidth = protectedApi.watchWidth(expanderEl, (width) => {
                        if (this._isUnmounting)
                            return;
                        this.setState({ expanderWidth: width });
                    });
                }
            };
        }
        render() {
            let { props, state, context } = this;
            let { dateProfile } = props;
            let { options } = context;
            /* date */
            let tDateProfile = this.buildTimelineDateProfile(dateProfile, context.dateEnv, options, context.dateProfileGenerator);
            let { unit: timerUnit, value: timeUnitValue } = protectedApi.greatestDurationDenominator(tDateProfile.slotDuration);
            /* table settings */
            let { groupSpecs, groupRowDepth, orderSpecs, colSpecs, groupColCnt, colWidthConfigs: initialColWidthConfigs, superHeaderRendering, } = this.processColOptions(context.options);
            const spreadsheetWidthConfig = this.spreadsheetResizedWidthConfigRef.current ??
                this.parseResourceColumnsWidth(options.resourceColumnsWidth);
            /* spreadsheet col widths */
            let spreadsheetColWidthConfigs = state.colWidthOverrides || initialColWidthConfigs;
            let [spreadsheetColWidths, spreadsheetCanvasWidth] = state.spreadsheetClientWidth != null
                ? pixelizeDimConfigs(spreadsheetColWidthConfigs, state.spreadsheetClientWidth)
                : [undefined, undefined];
            this.spreadsheetColWidthConfigs = spreadsheetColWidthConfigs;
            this.spreadsheetColWidths = spreadsheetColWidths;
            /* table hierarchy */
            let resourceStore = this.filterResourceStore(props.resourceStore, options.filterResourcesWithEvents, props.rawEventStore, dateProfile.activeRange);
            let resourceHierarchy = this.buildResourceHierarchy(resourceStore, orderSpecs, groupSpecs, groupRowDepth);
            let hasNesting = this.computeHasNesting(resourceHierarchy);
            /* table positions */
            let [timeCanvasWidth, slotWidth, slotLiquid] = this.computeSlotWidth(tDateProfile.slotCnt, tDateProfile.slotsPerLabel, options.slotMinWidth, state.slotInnerWidth, // is ACTUALLY the last-level label width. rename?
            state.timeClientWidth);
            /* event display */
            let splitProps = this.resourceSplitter.splitProps({ ...props, resourceStore });
            let bgLaneProps = splitProps[''];
            let bgSlicedProps = this.bgSlicer.sliceProps(bgLaneProps, dateProfile, tDateProfile.isTimeScale ? null : options.nextDayThreshold, context, // wish we didn't need to pass in the rest of these args...
            dateProfile, context.dateProfileGenerator, tDateProfile, context.dateEnv);
            /* business hour display */
            let hasResourceBusinessHours = this.computeHasResourceBusinessHours(resourceHierarchy);
            let fallbackBusinessHours = hasResourceBusinessHours ? props.businessHours : null;
            return (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(protectedApi.NowTimer, { unit: timerUnit, unitValue: timeUnitValue, children: (nowDate, todayRange, nowMs) => {
                            const baseProps = {
                                className: props.className,
                                tDateProfile,
                                dateProfile,
                                resourceHierarchy,
                                resourceEntityExpansions: props.resourceEntityExpansions,
                                hasNesting,
                                nowDate,
                                nowMs,
                                todayRange,
                                colSpecs,
                                groupColCnt,
                                superHeaderRendering,
                                splitProps,
                                bgSlicedProps,
                                slotWidth,
                                timeCanvasWidth,
                                spreadsheetColWidths,
                            };
                            return props.forPrint ? (jsxRuntime.jsx(ResourceTimelineLayoutPrint, { ...baseProps, hasResourceBusinessHours: hasResourceBusinessHours, spreadsheetWidthConfig: spreadsheetWidthConfig, timeCanvasClipStart: this.scrollRef.current.x /* for simulating horizontal scroll */, indentWidth: state.expanderWidth })) : (jsxRuntime.jsx(ResourceTimelineLayoutNormal, { ...baseProps, labelId: props.labelId, labelStr: props.labelStr, eventSelection: props.eventSelection, hasResourceBusinessHours: hasResourceBusinessHours, fallbackBusinessHours: fallbackBusinessHours, slotLiquid: slotLiquid, timeClientWidthRef: this.handleTimeClientWidth, slotInnerWidthRef: this.handleSlotInnerWidth, initialSpreadsheetWidthConfig: spreadsheetWidthConfig, spreadsheetCanvasWidth: spreadsheetCanvasWidth, initialScroll: this.scrollRef.current /* for reviving after print-view */, 
                                // refs
                                spreadsheetResizedWidthConfigRef: this.spreadsheetResizedWidthConfigRef, spreadsheetClientWidthRef: this.handleSpreadsheetClientWidth, scrollRef: this.scrollRef, 
                                // handlers
                                onColResize: this.handleColResize, indentWidth: state.expanderWidth }));
                        } }), jsxRuntime.jsx(ResourceExpander // for probing size
                    , { isExpanded: true, elRef: this.handleExpanderEl, className: classNames__default["default"].offscreen })] }));
        }
        componentDidMount() {
            this._isUnmounting = false;
        }
        componentWillUnmount() {
            this._isUnmounting = true;
        }
    }
    ResourceTimelineView.addStateEquality({
        colWidthOverrides: protectedApi.isArraysEqual,
    });
    function computeHasResourceBusinessHours(resourceHierarchy) {
        for (const node of resourceHierarchy) {
            if ((node.resourceFields && node.entity.businessHours) ||
                computeHasResourceBusinessHours(node.children)) {
                return true;
            }
        }
        return false;
    }
    function computeHasNesting(resourceHierarchy) {
        for (const node of resourceHierarchy) {
            if ((node.children.length && !node.pooledHeight) || // has children, but NOT a col-spanning group
                computeHasNesting(node.children)) {
                return true;
            }
        }
        return false;
    }
    /*
    An invalid value gets the default, instead of failing to render
    */
    function parseResourceColumnsWidth(input) {
        return parseDimOption(input, MIN_RESOURCE_AREA_WIDTH, 'option `resourceColumnsWidth`', `Using ${DEFAULT_RESOURCE_COLUMNS_WIDTH}.`) ?? parseDimConfig(DEFAULT_RESOURCE_COLUMNS_WIDTH, MIN_RESOURCE_AREA_WIDTH);
    }

    var resourceTimelinePlugin = {
        name: 'resource-timeline',
        premiumReleaseDate: '2026-11-12',
        deps: [
            premiumCommonPlugin,
            resourcePlugin,
            timelinePlugin,
        ],
        initialView: 'resourceTimelineDay',
        views: {
            resourceTimeline: {
                type: 'timeline', // inherit configuration
                component: ResourceTimelineView,
                needsResourceData: true,
                resourceColumnsWidth: DEFAULT_RESOURCE_COLUMNS_WIDTH,
                resourcesInitiallyExpanded: true,
                eventResizableFromStart: true, // TODO: not DRY with this same setting in the main timeline config
            },
            resourceTimelineDay: {
                type: 'resourceTimeline',
                duration: { days: 1 },
            },
            resourceTimelineWeek: {
                type: 'resourceTimeline',
                duration: { weeks: 1 },
            },
            resourceTimelineMonth: {
                type: 'resourceTimeline',
                duration: { months: 1 },
            },
            resourceTimelineYear: {
                type: 'resourceTimeline',
                duration: { years: 1 },
            },
        },
    };

    var scrollGridPlugin = {
        name: 'scrollgrid',
        premiumReleaseDate: '2026-11-12',
        deps: [premiumCommonPlugin],
        scrollerSyncerClass: ScrollerSyncer
    };

    let contexts = [];
    function contextInit(context) {
        if (!contexts.length) {
            attachGlobalHandlers();
        }
        contexts.push(context);
        context.calendarApi.on('_unmount', () => {
            protectedApi.removeExact(contexts, context);
            if (!contexts.length) {
                removeGlobalHandlers();
            }
        });
    }
    function attachGlobalHandlers() {
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        /*
        // for testing
        let forPrint = false
        document.addEventListener('keypress', (ev) => {
          if (ev.key === 'p') {
            forPrint = !forPrint
            if (forPrint) {
              handleBeforePrint()
            } else {
              handleAfterPrint()
            }
          }
        })
        */
    }
    function removeGlobalHandlers() {
        window.removeEventListener('beforeprint', handleBeforePrint);
        window.removeEventListener('afterprint', handleAfterPrint);
    }
    function handleBeforePrint() {
        for (let context of contexts) {
            context.emitter.trigger('_beforeprint');
        }
    }
    function handleAfterPrint() {
        for (let context of contexts) {
            context.emitter.trigger('_afterprint');
        }
    }

    var adaptivePlugin = {
        name: 'adaptive',
        premiumReleaseDate: '2026-11-12',
        deps: [premiumCommonPlugin],
        contextInit,
    };

    publicApi.globalPlugins.push(resourceDayGridPlugin, resourceTimeGridPlugin, resourceTimelinePlugin, scrollGridPlugin, timelinePlugin, adaptivePlugin);

})(FullCalendar.ProtectedApi, FullCalendar.DayGrid, FullCalendar.PreactJSXRuntime, FullCalendar, FullCalendar.ProtectedStyles, FullCalendar.Preact, FullCalendar.TimeGrid);
