{* HEADER *}

{assign var="elementGroup" value="none"}
{foreach from=$elementGroups key=elementName item=groupName}
    {if $groupName NE $elementGroup}
        {if $groupName EQ 'none'}
        </div>
        {else}
            {if isset($group_labels.$groupName)}
                <div id="{$groupName}" style="border:1px solid gray; margin-bottom: 10px; padding-top: 10px" >
                <div class="crm-section">
                    <span class="content">{$group_labels.$groupName}</span> 
                </div>
            {else}
            <div id="{$groupName}" style="border:1px solid gray; margin-bottom: 10px; padding-top: 10px" >
            {/if}
        {/if}
    {/if}
    {assign var="elementGroup" value="`$groupName`"}
    <div class="crm-section">
        <div class="label">{$form.$elementName.label}</div>
        <div class="content">{$form.$elementName.html}
            {if isset($descriptions.$elementName)}<br /><span class="description">{$descriptions.$elementName}</span>{/if}
        </div>
        <div class="clear"></div>
    </div>
{/foreach}
<div class="crm-section">
    <div>
        {if isset($descriptions.delete_warning)}<br /><span id="delete_warning" class="description">{$descriptions.delete_warning}</span>{/if}
    </div>
    <div class="clear"></div>
</div>

{* FOOTER *}
<div class="crm-submit-buttons">
    {include file="CRM/common/formButtons.tpl" location="bottom"}
    {crmButton p='civicrm/admin/resource-calendars' icon="times"}{ts}Cancel{/ts}{/crmButton}
</div>
{literal}<script type="text/javascript">
    CRM.$(function ($) {
      $('#cs_available_templates').change(function () {
        let value = $(this).val();
        let selected = $('#cs_available_templates :selected').
          map((i, el) => {return {id: $(el).val(), text: $(el).text()}}).get();
        let templateFields = $('[id^=cs_event_template]');
        templateFields.map((i, field) => {
          let fval = $(field).val();
          $('#'+field.id).empty();
            $('#'+field.id).append('<option value="">' + this.attributes.placeholder + '</option>');
          selected.forEach((s) => {
            $('#'+field.id).append('<option value="' + s.id + '">' + s.text + '</option>');
          });
          $(field).val(fval);
        });
      });
      $('[type="checkbox"').change(function () {
        let id = $(this)[0].id;
        let value = $('#' + id).is(":checked");
        if (id.startsWith('cs_price_calc')) {
          let groupId = id.replace('cs_price_calc', 'group');
          let fieldId = id.replace('cs_price_calc', 'cs_price_field');
          if (value) {
            let templateId = id.replace('cs_price_calc_t', '');
            if (isNaN(templateId)) {
                let tempId = id.replace('cs_price_calc', 'cs_event_template');
                templateId = $('#' + tempId).val();
            }
            $.ajax({
              url: 'civicrm/ajax/event-pricefields?event_id=' + templateId,
              type: "GET",
              dataType: "json",
              success: function (data) {
                $('#' + fieldId).empty();
                $.each(data, function (i, f) {
                  $('#' + fieldId).append('<option value="' + i + '">' + f + '</option>');
                });
                console.log(data);
                $('#' + groupId).show();
              },
              error: function (error) {
                console.log(error);
              }
            });
          } else {
            $('#' + groupId).hide();
          }
          console.log(id + ' changed to ' + value);
        }
      });
      $('#cs_available_templates').trigger('change');
    });
</script>{/literal}
