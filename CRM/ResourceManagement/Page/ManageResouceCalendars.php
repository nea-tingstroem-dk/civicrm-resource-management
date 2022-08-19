<?php
use CRM_ResourceManagement_ExtensionUtil as E;

class CRM_ResourceManagement_Page_ManageResouceCalendars extends CRM_Core_Page_Basic {

    static $_links = NULL;

    public function getBAOName() {
        return 'CRM_ResourceManagement_BAO_ResourceCalendar';
    }

    public function &links() {
        if (!(self::$_links)) {
            self::$_links = array(
                CRM_Core_Action::UPDATE => array(
                    'name' => ts('View/Edit'),
                    'url' => 'civicrm/resource-calendarsettings',
                    'qs' => 'action=update&id=%%id%%&reset=1',
                    'title' => ts('Edit Resource Calendar'),
                ),
                CRM_Core_Action::DELETE => array(
                    'name' => ts('Delete'),
                    'url' => 'civicrm/resource-calendarsettings',
                    'qs' => 'action=delete&id=%%id%%',
                    'title' => ts('Delete Resource Calendar'),
                ),
                CRM_Core_Action::VIEW => array(
                    'name' => ts('Preview'),
                    'url' => 'civicrm/showresourceevents',
                    'qs' => 'id=%%id%%',
                    'title' => ts('Preview Resource Calendar'),
                ),
            );
        }
        return self::$_links;
    }

    public function run() {
        CRM_Utils_System::setTitle(E::ts('Manage Resource Calendars'));

        $resourceTypes = CRM_ResourceManagement_BAO_ResourceConfiguration::getConfig('resource_types');
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

}
