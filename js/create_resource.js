/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Other/javascript.js to edit this template
 */
CRM.$(function ($) {
  console.log('Was here');
  const start_str = $('input[name=start_date]').val();
  console.log(start_str);
  const end_str = $('input[name=end_date]').val();
  console.log(end_str);
  const resources = JSON.parse($('input[name=resource_source]').val());
  const start_date = new Date(Date.parse(start_str));
  console.log(start_date);
  const end_date = new Date(Date.parse(end_str));
  $('#event_start_date').val(start_str).trigger('change');
  $('#event_end_date').val(end_str).trigger('change');
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
    console.log(startPick);
//    CRM.$('#event_start_date').crmDatepicker({
//      minDate; min_start,
//      maxDate; max_end
//    });
//    CRM.$('#event_end_date').crmDatepicker({
//      minDate; min_start,
//      maxDate; max_end
//    });
//    .datepicker({
//      minDate; min_start,
//      maxDate; max_end
//    });
//    $('#event_end_date').datepicker({
//      minDate; min_start,
//      maxDate; max_end
//    });
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
    if (end_date_dur.diff($('input[name=max_end'), 'seconds') > 0) {
      ('#event_end_date').val($('input[name=max_end')).trigger('change');
    } else {
      $('#event_end_date').val(end_date_dur.format("YYYY-MM-DD HH:mm:ss")).trigger('change');
    }
  });
  $('#event_end_date').change(function () {
    if (moment($(this).val()).diff($('input[name=max_end]').val(), 'seconds') > 0) {
      alert(ts('Latest end is ' + $('input[name=max_end]').val()));
      $('#event_end_date').val($('input[name=max_end]').val()).trigger('change');
      return;
    }
  });
  $('#resources').trigger('change');
});


