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

{foreach from=$groupTrees key="resId" item="priceSets"}
    <div class="crm-section hidden" id="grp_{$resId}">
        {foreach from=$priceSets key="psId" item="priceSet"}
            <div class="messages help">{$priceSet.help_pre}</div>
            {foreach from=$priceSet.fields key="fieldId" item="element"}
                {* Skip 'Admin' visibility price fields WHEN this tpl is used in online registration unless user has administer CiviCRM permission. *}
                {if $element.visibility EQ 'public' || ($element.visibility EQ 'admin' && $adminFld EQ true)}
                    {assign var="element_name" value="pf_"|cat:$resId|cat:"_"|cat:$psId|cat:"_"|cat:$fieldId}
                    {if ($element.html_type eq 'CheckBox' || $element.html_type == 'Radio') && $element.options_per_line}
                      <div class="label">{$form.$element_name.label}</div>
                      <div class="content {$element.name}-content">
                        {assign var="elementCount" value="0"}
                        {assign var="optionCount" value="0"}
                        {assign var="rowCount" value="0"}
                        {foreach name=outer key=key item=item from=$form.$element_name}
                          {assign var="elementCount" value=`$elementCount+1`}
                          {if is_numeric($key) }
                            {assign var="optionCount" value=`$optionCount+1`}
                            {if $optionCount == 1}
                              {assign var="rowCount" value=`$rowCount+1`}
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
                      </div>
                    {else}
                        <div class="label">{$form.$element_name.label}</div>
                        <div class="content {$element.name}-content">
                          {$form.$element_name.html}
                          {if $element.html_type eq 'Text'}
                            {if $element.is_display_amounts}
                            <span class="price-field-amount{if $form.$element_name.frozen EQ 1} sold-out-option{/if}">
                            {foreach item=option from=$element.options}
                              {if ($option.tax_amount || $option.tax_amount == "0") && $displayOpt && $invoicing}
                                {assign var="amount" value=`$option.amount+$option.tax_amount`}
                                {if $displayOpt == 'Do_not_show'}
                                  {$amount|crmMoney:$currency}
                                {elseif $displayOpt == 'Inclusive'}
                                  {$amount|crmMoney:$currency}
                                  <span class='crm-price-amount-tax'> {ts 1=$taxTerm 2=$option.tax_amount|crmMoney:$currency}(includes %1 of %2){/ts}</span>
                                {else}
                                  {$option.amount|crmMoney:$currency}
                                  <span class='crm-price-amount-tax'> + {$option.tax_amount|crmMoney:$currency} {$taxTerm}</span>
                                {/if}
                              {else}
                                {$option.amount|crmMoney:$currency} {$fieldHandle} {$form.$fieldHandle.frozen}
                              {/if}
                              {if $form.$element_name.frozen EQ 1} ({ts}Sold out{/ts}){/if}
                            {/foreach}
                            </span>
                            {else}
                              {* Not showing amount, but still need to conditionally show Sold out marker *}
                              {if $form.$element_name.frozen EQ 1}
                                <span class="sold-out-option">({ts}Sold out{/ts})<span>
                              {/if}
                            {/if}
                          {/if}
                          {if $element.help_post}<br /><span class="description">{$element.help_post}</span>{/if}
                        </div>
                    {/if}
                {/if}
            {/foreach}
        {/foreach}
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
        for (key in resources) {
            $('#grp_'+key).hide();
        }
        if ($(this).val()) {
          $('#grp_'+$(this).val()).show();
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
            CRM.confirm( 
              {
                title: title,
                message: message
              }).on('crmConfirm:yes', function () {
                thisOne.val(0);
                thisOne.trigger('click');
              });
          }
        });
      $('#resources').change();
    });
    </script>{/literal}
