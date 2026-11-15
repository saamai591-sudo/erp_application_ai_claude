CREATE VIEW [APS].[FactPersonelVoucherSettingDl]

AS 


SELECT pvsd.PersonelVoucherSettingDlID,
 pvsd.PersonelVoucherSettingID, pvsd.DlTypeID, pvsd.DlID
  FROM pay.PersonelVoucherSettingDl AS pvsd
