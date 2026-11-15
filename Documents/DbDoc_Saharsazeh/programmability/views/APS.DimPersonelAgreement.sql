



/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 4/21/2018 3:12:02 PM
 ************************************************************/

CREATE VIEW [APS].[DimPersonelAgreement]
AS 
 
 
SELECT 
cast(cmpa.CalendarMonthID AS bigint)*1000000000+cast(cmpa.PersonelID AS BIGINT) AS Id,
cmpa.PersonelID,
       cmpa.CalendarMonthID,
       a.CostCenterID,
       a.JobID,
       a.PositionID,
       a.EmploymentTypeID,
       a.EmploymentStatusID,
       a.WorkPlaceID,
       a.PayrollGroupID,
       a.PayrollBaseID,
       a.OccupationGradeID,
       a.BranchID,
       cmpvs.PersonelVoucherSettingID,
       cmpvs.PayrollAccGroupID
FROM   hrm.CalendarMonthPersonelAgreement AS cmpa
       INNER JOIN hrm.[CalendarMonthPersonelStatusAtAnyDay] AS cmps
            ON  cmps.PersonelID = cmpa.PersonelID
            AND cmps.CalendarMonthID = cmpa.CalendarMonthID
       INNER JOIN hrm.Agreement AS a
            ON  a.AgreementID = cmpa.AgreementID
        LEFT JOIN hrm.CalendarMonthPersonelVoucherSetting AS cmpvs
        ON cmpvs.PersonelID=cmpa.PersonelID
        AND cmpvs.CalendarMonthID=cmpa.CalendarMonthID
--WHERE  cmps.[STATUS] <> 3
    
