{if $resources == TRUE}
    <select id="resource_selector" class="crm-form-select crm-select2 crm-action-menu fa-plus">
        <option value="0">{ts}All{/ts}</option>
        {foreach from=$resources item=resource}
            <option value="{$resource.id}">{$resource.title}</option>
        {/foreach}
    </select>
{/if}
<div id="calendar"></div>
{literal}
    <script type="text/javascript">
        if (typeof (jQuery) != 'function') {
          var jQuery = cj;
        } else {
          var cj = jQuery;
        }

        cj(function ( ) {
          checkFullCalendarLIbrary()
                  .then(function () {
                    buildCalendar();
                  })
                  .catch(function () {
                    alert('Error loading calendar, try refreshing...');
                  });
        });

        /*
         * Checks if full calendar API is ready.
         *
         * @returns {Promise}
         *  if library is available or not.
         */
        function checkFullCalendarLIbrary() {
          return new Promise((resolve, reject) => {
            if (cj.fullCalendar) {
              resolve();
            } else {
              cj(document).ajaxComplete(function () {
                if (cj.fullCalendar) {
                  resolve();
                } else {
                  reject();
                }
              });
            }
          });
        }

        function buildCalendar( ) {
          var showTime = {/literal}{$time_display}{literal};
          var weekStartDay = {/literal}{$weekBeginDay}{literal};
          var use24HourFormat = {/literal}{$use24Hour}{literal};
          var calendarId = {/literal}{$calendar_id}{literal};
          const defaultStartDate = (localStorage.getItem("fcDefaultStartDate") !== null ? localStorage.getItem("fcDefaultStartDate") : moment());

          cj('#calendar').fullCalendar({
            events: {
              url: '/civicrm/ajax/resource-events',
              data: {
                calendar_id: {/literal}{$calendar_id}{literal},
                filter: '0'
              }
            },
            failure: function () {
              alert('there was an error while fetching events!');
            },
            select: function (start, end, jsEvent, view) {
              var allDay = "1";
              if (start.hasTime()) {
                allDay = "0";
              }
              location.href = "/civicrm/book-resource?calendar_id=" + calendarId +
                      "&filter=" + cj('#resource_selector')[0].value +
                      "&start=" + moment(start).format("YYYY-MM-DD HH:mm:ss") +
                      "&end=" + moment(end).format("YYYY-MM-DD HH:mm:ss") +
                      "&allday=" + allDay;
              CRM.$('#calendar').crmSnippet({
                url: CRM.url(url, '')
              });
            },
            loading: function (isLoading) {
              this.selectable = !isLoading;
            },
            viewRender: function (view, element) {
              // when the view changes, we update our localStorage value with the new view name
              localStorage.setItem("fcDefaultView", view.name);
              localStorage.setItem("fcDefaultStartDate", view.start);
            },
            eventClick: function (event, el, jsEvent) {
              el.preventDefault();
              let conf = CRM.confirm({
                title: ts('Select option'),
                message: ts('Show Event?'),
                options: {
                    yes: ts('Yes'),
                    no: ts('No'),
                }
              }).on('crmConfirm:yes', function () {
                if (event.url) {
                  window.open(event.url);
                }
              });

            },
            displayEventEnd: true,
            displayEventTime: showTime ? 1 : 0,
            firstDay: weekStartDay,
            timeFormat: use24HourFormat ? 'HH:mm' : 'hh(:mm)A',
            header: {
              left: 'prev,next today',
              center: 'title',
              right: 'month,agendaWeek,agendaDay'
            },
            defaultView: (localStorage.getItem("fcDefaultView") !== null ? localStorage.getItem("fcDefaultView") : "agendaWeek"),
            defaultDate: (localStorage.getItem("fcDefaultStartDate") !== null ? localStorage.getItem("fcDefaultStartDate") : moment()),
            lang: 'da',
            selectable: true,
            selectOverlap: false,
            initialDate: defaultStartDate,
          });

          CRM.$(function ($) {
            $("#resource_selector").change(function () {
              const source = cj('#calendar').fullCalendar('getEventSources')[0];
              source.ajaxSettings.data.filter = this.value;
              cj('#calendar').fullCalendar('refetchEvents');
            });
            $("#resource_selector").val("0").trigger('change');
          });
        }
    </script>
{/literal}
