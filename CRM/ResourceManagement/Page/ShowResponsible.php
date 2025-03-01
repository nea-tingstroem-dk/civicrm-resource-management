<?php

use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_ShowResponsible extends CRM_Core_Page {

  public function run() {
    // Example: Set the page-title dynamically; alternatively, declare a static title in xml/Menu/*.xml
    CRM_Utils_System::setTitle(E::ts('Show Responsible'));

    $cid = CRM_Utils_Request::retrieve('cid', 'Integer');

    $contacts = \Civi\Api4\Contact::get(TRUE)
      ->addSelect('external_identifier', 'display_name', 'phone_primary.phone_numeric', 'email_primary.email')
      ->addWhere('id', '=', $cid)
      ->setLimit(1)
      ->execute();
    foreach ($contacts as $contact) {
      $this->assign('contact', $contact);
    }

    parent::run();
  }

}
