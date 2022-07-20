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
                  "&start=" + start.format("YYYY-MM-DD HH:mm:ss") + 
                  "&end=" + end.format("YYYY-MM-DD HH:mm:ss") +
                  "&allday=" + allDay;
        },
        lang: 'da',
        displayEventEnd: true,
        displayEventTime: showTime ? 1 : 0,
        firstDay: weekStartDay,
        timeFormat: use24HourFormat ? 'HH:mm' : 'hh(:mm)A',
        header: {
          left: 'prev,next today',
          center: 'title',
          right: 'month,agendaWeek,agendaDay'
        },
        selectable: true,
        selectOverlap: false,
      });

      CRM.$(function ($) {
        $("#resource_selector").change(function () {
          const source = cj('#calendar').fullCalendar('getEventSources')[0];
          source.ajaxSettings.data.filter=this.value;
          cj('#calendar').fullCalendar('refetchEvents');
        });
        $("#resource_selector").val("0").trigger('change');
      });
    }
</script>
{/literal}
