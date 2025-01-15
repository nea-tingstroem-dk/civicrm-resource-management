<?php

use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_ManageResourceCalendars extends CRM_Core_Page_Basic {

    static $_links = NULL;

    public function getBAOName() {
        return 'CRM_ResourceManagement_BAO_ResourceCalendar';
    }

    public function assign($var, $value = NULL) {
        if ($var ==='rows' && is_array($value)) {
            foreach ($value as $i => $row) {
                $value[$i]['calendar_label'] = CRM_Contact_BAO_ContactType::getLabel($row['calendar_type']);
            }
        }
        parent::assign($var, $value);
    }

    public function &links() {
        if (!(self::$_links)) {
            self::$_links = array(
                CRM_Core_Action::UPDATE => array(
                    'name' => ts('View/Edit'),
                    'url' => 'civicrm/resource-calendarsettings',
                    'qs' => 'action=update&id=%%id%%&reset=1',
                    'title' => ts('Edit Resource Calendar'),
                    'weight' => 10,
                ),
                CRM_Core_Action::DELETE => array(
                    'name' => ts('Delete'),
                    'url' => 'civicrm/resource-calendarsettings',
                    'qs' => 'action=delete&id=%%id%%',
                    'title' => ts('Delete Resource Calendar'),
                    'weight' => 20,
                ),
                CRM_Core_Action::VIEW => array(
                    'name' => ts('Preview'),
                    'url' => 'civicrm/showresourceevents',
                    'qs' => 'id=%%id%%',
                    'title' => ts('Preview Resource Calendar'),
                    'weight' => 30,
                ),
            );
        }
        return self::$_links;
    }

    public function run() {
        CRM_Utils_System::setTitle(E::ts('Manage Resource Calendars'));
        Civi::resources()->addScriptFile('resource-management', 'jscolor.js');
        Civi::resources()->addScriptFile('resource-management', 'resourcecalendar.js');

        $resourceTypes = CRM_ResourceManagement_BAO_ResourceConfiguration::getConfig('resource_types');
        if (!$resourceTypes) {
            CRM_Core_Session::setStatus(E::ts('You need to configure Resource Management before use'));
            CRM_Utils_System::redirect(CRM_Utils_System::url('civicrm/admin/resource-mamagement', 'reset=1'));
        }
        $query = "SELECT * FROM `civicrm_contact_type`
                WHERE id in ({$resourceTypes});";
        $dao = CRM_Core_DAO::executeQuery($query);

        $resourcetypes = [];
        while ($dao->fetch()) {
            $resourcetype = [];
            $resourcetype['resource_id'] = $dao->name;
            $resourcetype['label'] = $dao->label;
            $resourcetypes[] = $resourcetype;
        }
        $this->assign('resources', $resourcetypes);
//        $this->assign('cal_rows', $this->getCalendarRows());
        return parent::run();
    }

    public function editForm() {
        return 'CRM_ResourceManagement_Form_ResourceCalendarSettings';
    }

    public function editName() {
        return 'Resource Calendars';
    }

    public function userContext($mode = NULL) {
        return 'civicrm/admin/resource-calendars';
    }

//    private function getCalendarRows() {
//        $rows = [];
//        $sql = "SELECT c.id, c.calendar_title, t.label 
//                FROM `civicrm_resource_calendar` c
//                LEFT JOIN `civicrm_contact_type` t on t.name = c.calendar_type;";
//        $dao = $dao = CRM_Core_DAO::executeQuery($sql);
//        while ($dao->fetch()) {
//            $rows[] = [
//                'id' => $dao->id,
//                'calendar_title' => $dao->calendar_title,
//                'calendar_type' => $dao->label
//            ];
//        }
//        return $rows;
//    }
}
