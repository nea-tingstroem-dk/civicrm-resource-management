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

{foreach from=$groupTrees key="eventId" item="priceSets"}
  <div class="crm-section hidden" id="grp_{$eventId}" name="pricegroup">
    {foreach from=$priceSets key="psId" item="priceSet"}
      <div class="messages help">{$priceSet.help_pre}</div>
      {foreach from=$priceSet.fields key="fieldId" item="element"}
        {* Skip 'Admin' visibility price fields WHEN this tpl is used in online registration unless user has administer CiviCRM permission. *}
        {if $element.visibility EQ 'public' || ($element.visibility EQ 'admin' && $adminFld EQ true)}
          {assign var="element_name" value="pf_"|cat:$eventId|cat:"_"|cat:$psId|cat:"_"|cat:$fieldId}
          {if ($element.html_type eq 'CheckBox' || $element.html_type == 'Radio') && $element.options_per_line}
            <div class="label">{$form.$element_name.label}</div>
            <div class="content {$element.name}-content" style="margin-bottom: 5px;">
              {assign var="elementCount" value="0"}
              {assign var="optionCount" value="0"}
              {assign var="rowCount" value="0"}
              {foreach name=outer key=key item=item from=$form.$element_name}
                {assign var="elementCount" value=$elementCount+1}
                {if is_numeric($key) }
                  {assign var="optionCount" value=$optionCount+1}
                  {if $optionCount == 1}
                    {assign var="rowCount" value=$rowCount+1}
                    <div class="price-set-row {$element.name}-row{$rowCount}">
                    {/if}
                    <span class="price-set-option-content">{$form.$element_name.$key.html}</span>
                    {if $optionCount == $element.options_per_line || $elementCount == $form.$element_name|@count}
                    </div>
                    {assign var="optionCount" value="0"}
                  {/if}
                {/if}
              {/foreach}
              {if $element.help_post}
                <div class="description">{$element.help_post}</div>
              {/if}
              <div class="clear"></div>
            </div>
          {else}
            <div class="label">{$form.$element_name.label}</div>
            <div class="content {$element.name}-content" style="margin-bottom: 5px;">
              {$form.$element_name.html}
              {if $element.html_type eq 'Text'}
                {if $element.is_display_amounts}
                  <span class="price-field-amount{if $form.$element_name.frozen EQ 1} sold-out-option{/if}">
                    {foreach item=option from=$element.options}
                        {$option.amount|crmMoney:$currency} 
                    {/foreach}
                  </span>
                {else}
                  {* Not showing amount, but still need to conditionally show Sold out marker *}
                  {if $form.$element_name.frozen EQ 1}
                    <span class="sold-out-option">({ts}Sold out{/ts})>
                    </span>
                  {/if}
                {/if}
              {/if}
              {if $element.help_post}<br /><span class="description">{$element.help_post}</span>{/if}
              <div class="clear"></div>
            </div>
          {/if}
        {/if}
      {/foreach}

    {/foreach}
  </div>
{/foreach}
<div class="crm-section hidden" id="sum_container">
  <div class="label">{$form.price_sum.label}</div>
  <div class="content">{$form.price_sum.html}</div>
  <div class="clear"></div>
</div>

{* FOOTER *}
<div class="crm-submit-buttons">
  {include file="CRM/common/formButtons.tpl" location="bottom"}
</div>

{crmScript ext="resource-management" file="js/create-resource-event.js"}
{literal}
  <script type="text/javascript">
    CRM.$(function ($) {
      //
      // Delete button
      //
      $('button').click(function (event) {
      if ($(this)[0].name.endsWith('delete') && $(this).val() == "1") {
        event.preventDefault();
        const title = {/literal}{ts}'Delete Event?'{/ts}{literal};
          const message = {/literal}{ts}'Delete cannot be reversed!'{/ts}{literal};
          const thisOne = $(this);
          CRM.confirm({ title: title,
            message: message})
          .on('crmConfirm:yes', function () {
            thisOne.val(0);
            thisOne.trigger('click');
          });
        };
      });
      //
      // Initialize
      //
      setTimeout(function () {
      var eId = $("[name=event_id]").val();
      if (eId) {
        $('#grp_' + eId).show();
      } else {
        var id = $('input[name=resources]').val();
        if (id) {
          var tId = resources[id].template_id;
          $('#grp_' + tId).show();
        } else {
          $('#resources').change();
        }
      }
      }, 1000);
      $(".ui-dialog").height("auto");
    });
  </script>
{/literal}
