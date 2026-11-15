/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/22/2018 10:43:03 AM
 ************************************************************/

CREATE VIEW [APS].[DimPersonelVoucherSetting]
AS 


SELECT CAST(Vpvs.CalendarMonthID AS BIGINT) * 1000000000 +
       CAST(Vpvs.PersonelID AS BIGINT) AS Id,
       Vpvs.PersonelID,
       Vpvs.CalendarMonthID,
       pvs.PayrollAccGroupID,
       vpvs.PersonelVoucherSettingID
FROM   HRM.[CalendarMonthPersonelVoucherSetting] Vpvs
       INNER JOIN pay.PersonelVoucherSetting AS pvs
            ON  pvs.PersonelVoucherSettingID = Vpvs.PersonelVoucherSettingID
