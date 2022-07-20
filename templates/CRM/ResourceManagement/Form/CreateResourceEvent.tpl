{* HEADER *}

{* FIELD EXAMPLE: OPTION 1 (AUTOMATIC LAYOUT) *}

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
{literal}
<script type="text/javascript">
    CRM.$(function ($) {
      const resources = {/literal}{$resources}{literal};
      const start_date = new Date(Date.parse('{/literal}{$start_time}{literal}'));
      const end_date = new Date(Date.parse('{/literal}{$end_time}{literal}'));
      $('#event_start_date').val('{/literal}{$start_time}{literal}').trigger('change');
      $('#event_end_date').val('{/literal}{$end_time}{literal}').trigger('change');
      $('#resource').change(function () {
        if ($(this).val()) {
          let min_start = Date.now();
          let max_end = start_date;
          for (id of $(this).val() ?? []) {
            let obj = resources[id];
            let min = Date.parse(obj.min_start);
            let max = Date.parse(obj.max_end);
            min_start = Math.max(min, min_start);
            max_end = Math.min(max, max_end);
          }
          if (min_start < Date.now()) {
              min_start = Date.now();
          }
          var start = new Date(min_start);
          const start_date_string = moment(start).format("YYYY-MM-DD HH:mm:ss");
          const end_date_string = moment(end).format("YYYY-MM-DD HH:mm:ss");
             
          $('#event_start_date').attr('mindate', start_date_string ).trigger('change');
          $('#event_end_date').val(end_date_string).trigger('change');
        }
      });
      $('#event_start_date').change(function() {
          console.log($(this).val());
          const start = new Date($(this).val());
          var default_end = new Date(start);
          default_end.setDate(start.getDate()+1);
          console.log(default_end);
          const end_date_string = moment(default_end).format("YYYY-MM-DD HH:mm:ss");
          $('#event_end_date').val(end_date_string).trigger('change');
      });       
      $('#resource').trigger('change');
    });
</script>
{/literal}
