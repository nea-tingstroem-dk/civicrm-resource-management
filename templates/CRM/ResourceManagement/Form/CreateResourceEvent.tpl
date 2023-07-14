{* HEADER *}

{if $error_message}
    <br /><span class="description">{$error_message}</span>   
{/if}

{foreach from=$elementNames item=elementName}
    <div class="crm-section">
        <div class="label">{$form.$elementName.label}</div>
        <div class="content">{$form.$elementName.html}</div>
        <div class="clear"></div>
    </div>
{/foreach}

{* FOOTER *}
<div class="crm-submit-buttons">
    {include file="CRM/common/formButtons.tpl" location="bottom"}
</div>

{literal}<script type="text/javascript">
    CRM.$(function ($) {
      const start_str = $('input[name=start_date]').val();
      const end_str = $('input[name=end_date]').val();
      const resources = JSON.parse($('input[name=resource_source]').val());
      const start_date = new Date(Date.parse(start_str));
      const end_date = new Date(Date.parse(end_str));
      $('#resources').change(function () {
        let min_start = Date.now();
        let max_end = start_date;
        if ($(this).val()) {
          for (id of $(this).val()) {
            let obj = resources[id];
            let min = Date.parse(obj.min_start);
            let max = Date.parse(obj.max_end);
            min_start = Math.max(min, min_start);
            max_end = Math.min(max, max_end);
          }
        } else {
          for (key in resources) {
            let obj = resources[key];
            let min = Date.parse(obj.min_start);
            let max = Date.parse(obj.max_end);
            min_start = Math.max(min, min_start);
            max_end = Math.min(max, max_end);
          }
        }
        let startPick = CRM.$('#event_start_date');
      });
      $('#event_start_date').change(function () {
        if (moment($(this).val()).diff($('input[name=min_start]').val(), 'seconds') < 0) {
          alert(ts('Erliest start is ' + $('input[name=min_start]').val()));
          $('#event_start_date').val($('input[name=min_start]').val()).trigger('change');
          return;
        }
        const start = new Date($(this).val());
        var seconds = parseInt($('input[name=duration]').val());
        const end_date_dur = moment(start).add(seconds, 's');
//        if (end_date_dur.diff($('input[name=max_end'), 'seconds') > 0) {
//          ('#event_end_date').val($('input[name=max_end')).trigger('change');
//        } else {
//          $('#event_end_date').val(end_date_dur.format("YYYY-MM-DD HH:mm:ss")).trigger('change');
//        }
      });
      $('#CreateResourceEvent').on('submit', (function (event) {
        if (event.originalEvent.submitter.classList.contains('validate') &&
                !event.originalEvent.submitter.name.endsWith('submit_delete')) {
          var emptyFields = '';
          var z = $('.required');
          for (let i = 0; i < z.length; i++) {
            if (!z[i].value) {
              var lab = $('label[for="' + z[i].id + '"]').text();
              if (lab) {
                emptyFields += (emptyFields ? ' "' : '"') + lab.replace('*', '').trim() + '"';
              }
            }
            ;
          }
          if (emptyFields) {
            event.preventDefault();
            alert(ts('Please fill fields: ' + emptyFields, ts('Missing values')));
          }
        }
      }));
      $('#event_end_date').change(function () {
        if (moment($(this).val()).diff($('input[name=max_end]').val(), 'seconds') > 0) {
          alert(ts('Latest end is ' + $('input[name=max_end]').val()));
          $('#event_end_date').val($('input[name=max_end]').val()).trigger('change');
          return;
        }
      });
      $('button').click(function (event) {
        if ($(this)[0].name.endsWith('delete') && $(this).val() == "1") {
        event.preventDefault();
                const title = {/literal}{ts}'Delete Event?'{/ts}{literal};
                                const message = {/literal}{ts}'Delete cannot be reversed!'{/ts}{literal};
                                        const thisOne = $(this);
                                        CRM.confirm({
                                          title: title,
                                          message: message
                                        })
                                                .on('crmConfirm:yes', function () {
                                                  thisOne.val(0);
                                                  thisOne.trigger('click');
                                                });
                                        }
                                      });
                                    });
    </script>{/literal}
