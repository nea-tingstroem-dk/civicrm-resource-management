function showhidecolorbox(status_id) {
  var n = "eventcolorid_" + status_id;
  var m = "statusid_" + status_id;
  if(!cj("#"+m).is( ':checked')) {
    cj("#"+n).parents('.crm-section').hide();
  }
  else {
    cj("#"+n).parents('.crm-section').show();
  }
}

CRM.$(function($) {
  function updatecolor(label, color) {
    $('input[name="'+label+'"]').val( color );
  }

  $('input[id^=statusid_]').each(function(){
    var id = $(this).prop('id').replace('statusid_', '');
    var n = "eventcolorid_" + id;
    var m = "statusid_" + id;
    if(!$("#"+m).is( ':checked')) {
      $("#"+n).parents('.crm-section').hide();
    }
    else {
      $("#"+n).parents('.crm-section').show();
    }
  });
});
