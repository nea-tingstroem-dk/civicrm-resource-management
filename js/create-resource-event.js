/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Other/javascript.js to edit this template
 */
CRM.$(function ($) {
  const start_str = $('input[name=start_date]').val();
  const end_str = $('input[name=end_date]').val();
  const resources = JSON.parse($('input[name=resource_source]').val());
  const titles_json = $('input[name=event_titles]').val();
  const event_titles = titles_json ? JSON.parse($('input[name=event_titles]').val()) : '';
  const start_date = new Date(Date.parse(start_str));
  const end_date = new Date(Date.parse(end_str));
//
//  Calculate duration and price
//
  function calculate() {
    var res_id = $('input[name=resources]').val();
    if (!res_id) {
      res_id = $('#resources').val();
    }
    if (!res_id) {
      return;
    }
    var start = new Date($('#event_start_date').val());
    var end = new Date($('#event_end_date').val());
    var ms = end.getTime() - start.getTime();
    var interval = '';
    var factor = 0.0;
    var field = '';
    var field_id = '';
    var tId = $('#event_template').val();
    if (!tId) {
      tId = resources[res_id].template_id;
      if (!tId) {
        return;
      }
    }
    field = $('[name=price_field_' + tId + ']').val();
    if (!field) {
      return;
    }
    fieldId = field.replace('pf_', '');
    interval = $('[name=price_period_' + fieldId + ']').val();
    factor = parseFloat($('[name=price_factor_' + fieldId + ']').val());
    var dur = 0.0;
    if (interval === 'days') {
      dur = ms / (1000 * 3600 * 24);
    } else {
      dur = ms / (1000 * 3600);
    }
    var qty = Math.floor((dur + factor - 0.0001) / factor) * factor;
    $('#' + field).val(qty);
    $('#' + field).prop('disabled', true);
    $('#' + field).change();
    let pricesId = 'pf_' + fieldId.substring(0, fieldId.lastIndexOf('_'));
    var sum = 0.0;
    $('input[id^="' + pricesId + '"]').each(function () {
      let num = $(this).val();
      let unitAmount = $('[name=' + this.id.replace('pf_', 'price_unit_amount_') + ']').val();
      sum += num * unitAmount;
    });
    $('#price_sum').val(sum);
    $('#price_sum').prop('disabled', true);
    $('#price_sum').change();
    $('#sum_container').show();

  }
  ;
//
// When resource selection changes
//
  $('#resources').change(function () {
    $('#sum_container').hide();
    let min_start = Date.now();
    let max_end = start_date;
    let res_id = $(this).val();
    if (res_id !== '') {
      $.each($("div[name='pricegroup'"), function (k, el) {
        $("#" + el.id).hide();
      });
      $('#sum_container').hide();
      var tId = resources[res_id].template_id;
      $('#event_template').val(tId);
      $('#event_template').change();
      $('#grp_' + tId).show();
      let obj = resources[res_id];
      let min = Date.parse(obj.min_start);
      let max = Date.parse(obj.max_end);
      min_start = Math.max(min, min_start);
      max_end = Math.min(max, max_end);
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
    var tId = $('#event_template').val();
    if (!tId && res_id !== '') {
      tId = resources[res_id].template_id;
      $('#event_title').val(event_titles[tId]);
      calculate();
    } 
  });
//
// When template selection changes
//
  $('#event_template').change(function () {
    $('#sum_container').hide();
    $.each($("div[name='pricegroup'"), function (k, el) {
      $("#" + el.id).hide();
    });
    let tId = $(this).val();
    $('#grp_' + tId).show();
    $('#event_title').val(event_titles[tId]);
    calculate();
    $(".ui-dialog").height("auto");
  });
//
//When price field count changes
//
  $('input[id^=pf_]').change(function () {
    let id = this.id;
    if ($('input[name=' + id.replace('pf_', 'price_period_')).val() === undefined) {
      calculate();
    }
  });

//
// When start date changes
//
  $('#event_start_date').change(function () {
    if (moment($(this).val()).diff($('input[name=min_start]').val(), 'seconds') < 0) {
      alert(ts('Erliest start is ' + $('input[name=min_start]').val()));
      $('#event_start_date').val($('input[name=min_start]').val()).trigger('change');
      return;
    }
    const start = new Date($(this).val());
    var seconds = parseInt($('input[name=duration]').val());
    calculate();
  });
//
// Submit
//
  $('#CreateResourceEvent').on('submit', function (event) {
    if (event.originalEvent.submitter.classList.contains('validate') &&
      event.originalEvent.submitter.name.endsWith('submit_submit')) {
      var emptyFields = '';
      var z = $('#CreateResourceEvent').find('.required');
      for (let i = 0; i < z.length; i++) {
        if (!z[i].value) {
          var lab = $('label[for="' + z[i].id + '"]').text();
          if (lab) {
            emptyFields += (emptyFields ? ' "' : '"') + lab.replace('*', '').trim() + '"';
          }
        }
      }
      if (emptyFields) {
        event.preventDefault();
        alert(ts('Please fill fields: ' + emptyFields, ts('Missing values')));
      }
    }
  });
//
// Enddate changed
//  
  $('#event_end_date').change(function () {
    if (moment($(this).val()).diff($('input[name=max_end]').val(), 'seconds') > 0) {
      alert(ts('Latest end is ' + $('input[name=max_end]').val()));
      $('#event_end_date').val($('input[name=max_end]').val()).trigger('change');
    }
    calculate();
  });

});


