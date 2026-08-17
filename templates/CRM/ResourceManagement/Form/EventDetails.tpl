{* HEADER *}


{foreach from=$elementNames item=elementName}
  <div class="crm-section">
    <div class="label">{$form.$elementName.label}</div>
    <div class="content">{$form.$elementName.html}</div>
    <div class="clear"></div>
  </div>
{/foreach}

{* FIELD EXAMPLE: OPTION 2 (MANUAL LAYOUT)

  <div>
    <span>{$form.favorite_color.label}</span>
    <span>{$form.favorite_color.html}</span>
  </div>

{* FOOTER *}
<div class="crm-submit-buttons">
{include file="CRM/common/formButtons.tpl" location="bottom"}
</div>
{literal}
<script type="text/javascript">
CRM.$(function ($) {
  $('#resource_status').change(function () {
    let value = $(this).val();
    let res_id = $("[name=resource_id]").first().val();
    CRM.api4('Participant', 'update', {
  values: {"status_id":value},
  where: [["id", "=", res_id]]
}).then((results) => {
  console.log('Updated');  
}, (failure) => {
    console.log("Error "+ failure)
});
    
   });
});
</script>
{/literal}
