
<span>
  {if $resource_list == TRUE}
    <div class="crm-section">
      <div class="label">
        <label for="resource_selector">{$page_title}</label>
      </div>
      <div class="content">
        {html_options name=resource_selector id=resource_selector options=$resource_list selected=$default_resource}
      </div>
      <div class="clear"></div>
    </div>  
  {/if}
</span>
<div id="calendar" style="height:auto " ></div>
{literal}
  <script type="text/javascript">
    CRM.$(function ($) {
      var pageTitle = '{/literal}{$page_title}{literal}';
      $(".page-header").find(".title").text(pageTitle);
      $(function () {
        var showTime = {/literal}{$time_display}{literal};
        var weekStartDay = {/literal}{$weekBeginDay}{literal};
        var use24HourFormat = {/literal}{$use24Hour}{literal};
        var calendarId = {/literal}{$calendar_id}{literal};
        let scroll = {/literal}{$scroll}{literal};
        let eventSourceId = "events";
        const isAdmin = {/literal}{$is_admin}{literal}
        const defaultStartDate = (localStorage.getItem("fcDefaultStartDate") ? localStorage.getItem("fcDefaultStartDate") : moment().format('YYYY-MM-DD'));
        const defaultView = (localStorage.getItem("fcDefaultView") ? localStorage.getItem("fcDefaultView") : 'timeGridWeek');
        var isLoading = true;
        let calendarEl = document.getElementById("calendar");
        let calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: defaultView,
          initialDate: defaultStartDate,
          scrollTime: scroll,
          customButtons: {
            refresh: {
              text: 'Refresh',
              click: function () {
                calendar.refetchEvents();
              }
            }
          }, headerToolbar: {
            left: 'prev,next today refresh',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth'
          },
          firstDay: weekStartDay,
          slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            omitZeroMinute: false,
            hour12: false,
          },
          nowIndicator: true,
          views: {
            dayGrid: {
              // options apply to dayGridMonth, dayGridWeek, and dayGridDay views
            },
            timeGrid: {
              // options apply to timeGridWeek and timeGridDay views
            },
            week: {
              // options apply to dayGridWeek and timeGridWeek views
            },
            day: {
              // options apply to dayGridDay and timeGridDay views
            }
          },
          fixedWeekCount: false,
          height: 600,
          aspectRation: 1.8,
          locale: 'da',
          selectable: true,
          selectOverlap: false,
          stickyHeaderDates: true,
          eventSources: [
            {
              id: eventSourceId,
              url: '/civicrm/ajax/resource-events',
              method: 'POST',
              extraParams: {
                calendar_id: {/literal}{$calendar_id}{literal},
                filter: '0'
              },
              failure: function () {
                alert('there was an error while fetching events!');
              }
            }
          ],
          loading: function (is_loading) {
            isLoading = is_loading;
          },
          select: function (info) {
            if (isLoading) {
              alert(ts('Wait for data load'))
              return false;
            }
            $el = $('#calendar');
            $filter = $('#resource_selector')[0].value;
            if (typeof $filter === "string" && $filter.length === 0) {
              $filter = $('#resource_selector').children().first().val();
            }
            if (true) {
              var params = {
                calendar_id: calendarId,
                filter: $filter,
                start: info.start.toISOString(),
                end: info.end.toISOString(),
                allday: info.allDay,
                ret_url: window.location.href,
              };
              window.location.replace(CRM.url('civicrm/book-resource',
                params));
            } else {
              CRM.loadForm(CRM.url('civicrm/book-resource', {
                calendar_id: calendarId,
                filter: $filter,
                start: info.start.toISOString(),
                end: info.end.toISOString(),
                allday: info.allDay}),
                {
                  cancelButton: '.cancel.crm-form-submit',
                  autoResize: true
                })
                .on('crmFormSuccess', function (event, data) {
                  if (data.openpage) {
                    window.open(data.openpage);
                  }
                  calendar.refetchEvents();
                })
                .on('crmFormCancel', function (event, data) {
                  concole.log('Canceled');
                });
            }
          },
          eventContent: function (info) {
            let spanEl = document.createElement('span');
            spanEl.innerHTML = info.event.title;
            let arrayOfDomNodes = [spanEl];
            return {domNodes: arrayOfDomNodes};
          },
          viewClassNames: function (view, element) {
            // when the view changes, we update our localStorage value with the new view name
            localStorage.setItem("fcDefaultView", view.view.type);
            let startTime = moment(view.view.activeStart).format('YYYY-MM-DD');
            localStorage.setItem("fcDefaultStartDate", startTime);
          },
          eventClick: function (info) {
            info.jsEvent.preventDefault();
            CRM.loadForm(CRM.url(info.event.url, {
              action: 'edit',
              calendar_id: calendarId,
            }),
              {
                cancelButton: '.cancel.crm-form-submit'
              }
            )
              .on('crmFormSuccess', function (event, data) {
                if (data.openpage) {
                  window.open(data.openpage);
                }
                calendar.refetchEvents();
              })
              .on('crmFormCancel', function (event, data) {
                concole.log('Canceled');
              });
          }
        });
        calendar.render();
        $("#resource_selector").change(function () {
          let source = calendar.getEventSourceById(eventSourceId);
          source.internalEventSource._raw.extraParams.filter = this.value;
          calendar.refetchEvents();
        });
        $("#resource_selector").val("0").trigger('change');
      });
    });
  </script>
{/literal}
