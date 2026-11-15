CREATE   PROC [PAY].spTimeSheetControls
(    @CalculationPersonelID NVARCHAR(MAX),
	 @Type TINYINT,
	 @CalendarMonthID INT = NULL,
     @returnError BIT = 0
)
AS

DECLARE @ErrorMessage     NVARCHAR(MAX)

SELECT VALUE CalculationPersonelID
INTO   #CalculationPersonel
FROM   CFG.R_FnCommaStr2Table(@CalculationPersonelID)
    
 ---Find Personel Last PayrolAccGroup
 SELECT * INTO #vwPayrollAccConfiguration
 FROM pay.vwPayrollAccConfiguration AS vpac 
 WHERE vpac.CalendarMonthID = @CalendarMonthID
 
  SELECT * INTO #vwPersonelVoucherSetting
 FROM pay.vwPersonelVoucherSetting AS vpvs
 WHERE vpvs.CalendarMonthID = @CalendarMonthID
    
 SELECT vpvs.PersonelID,
        vpvs.PayrollAccGroupID,
        vpac.IsShareable
 INTO   #PersonelLastAccGroup
 FROM   #vwPersonelVoucherSetting  AS vpvs
        JOIN #vwPayrollAccConfiguration AS vpac
             ON  vpac.CalendarMonthID = vpvs.CalendarMonthID
             AND vpac.PayrollAccGroupID = vpvs.PayrollAccGroupID
        JOIN pay.CalculationPersonel  AS cp
             ON  vpvs.PersonelID = cp.PersonelID
             AND vpvs.CalendarMonthID = cp.CalendarMonthID
        JOIN #CalculationPersonel     AS cp2
             ON  cp.CalculationPersonelID = cp2.CalculationPersonelID

------@Type : 1 TimeSheetCalculation
------@Type:  2  DeleteTimeSheetCalculation
------@Type:  3  IssueVoucher

--- Control 1
------- check if all selected personel have a payrollaccgroup that is sharable

IF @Type = 1
BEGIN
	SELECT  p.Code,
			pa.Title + '' + pa.LastName as title 
	INTO #PersonnelWitUnshareableLastAccGroup
	FROM  #CalculationPersonel AS cp2
	JOIN pay.CalculationPersonel AS cp ON cp2.CalculationPersonelID = cp.CalculationPersonelID
	JOIN HRM.Personel p ON p.PersonelID = cp.PersonelID
	JOIN CFG.Party pa ON p.PartyID = pa.PartyID
	LEFT JOIN #PersonelLastAccGroup plag ON cp.PersonelID = plag.PersonelID                 
	WHERE plag.PayrollAccGroupID IS NULL OR plag.IsShareable = 0

    IF EXISTS (SELECT 1 FROM #PersonnelWitUnshareableLastAccGroup)
    BEGIN
		IF @returnError = 1
		BEGIN
		    SELECT * FROM #PersonnelWitUnshareableLastAccGroup;
			RETURN;
		END;
		ELSE
		BEGIN        
			RAISERROR ('PayrollManager.Calculation.GetPersonnelWitUnshareableLastAccGroup', 16, 10);
			RETURN;
		END        
    END
END

IF @Type = 1
BEGIN

	SELECT  
			p.Code,
			pa.Title + '' + pa.LastName as title 
	INTO #PersonnelWithoutTimeSheet
	FROM  #CalculationPersonel AS cp2
	JOIN pay.CalculationPersonel AS cp ON cp2.CalculationPersonelID = cp.CalculationPersonelID
	JOIN HRM.Personel p ON p.PersonelID = cp.PersonelID
	JOIN CFG.Party pa ON p.PartyID = pa.PartyID
	LEFT JOIN pay.TimeSheet AS ts ON ts.PersonelID = cp.PersonelID AND cp.CalendarMonthID = ts.CalendarMonthID
	WHERE ts.TimeSheetId IS NULL

    IF EXISTS (SELECT 1 FROM  #PersonnelWithoutTimeSheet)
    BEGIN
		IF @returnError = 1
		BEGIN
		    SELECT  * FROM #PersonnelWithoutTimeSheet;
			RETURN;
		END;
		ELSE
		BEGIN
			RAISERROR (N'PayrollManager.Calculation.GetExcelForPersonnelWithoutTimeSheet', 16, 10);
			RETURN;
		END
    END
END

IF @Type = 1
BEGIN
	SELECT  
			p.Code,
			pa.Title + '' + pa.LastName as title 
	INTO #PersonnelWithCalculatedTimeSheet
	FROM  #CalculationPersonel AS cp2
	JOIN pay.TimeSheetCalculationPersonel  AS tscr ON cp2.CalculationPersonelID = tscr.CalculationPersonelID
	JOIN pay.CalculationPersonel AS cp ON cp2.CalculationPersonelID = cp.CalculationPersonelID
	JOIN HRM.Personel p ON p.PersonelID = cp.PersonelID
	JOIN CFG.Party pa ON p.PartyID = pa.PartyID

	IF EXISTS ( SELECT 1 FROM #PersonnelWithCalculatedTimeSheet )
	BEGIN
		IF @returnError = 1
		BEGIN
		    SELECT  * FROM #PersonnelWithCalculatedTimeSheet;
			RETURN;
		END;
		ELSE
		BEGIN
			RAISERROR (N'PayrollManager.Calculation.GetExcelForPersonnelWithCalculatedTimeSheet', 16, 10);
			RETURN;
		END
	END
END

IF @Type = 2
BEGIN
	SELECT  
			p.Code,
			pa.Title + '' + pa.LastName as title 
	INTO #CalculationPersonelWithoutVoucher
	FROM #CalculationPersonel AS cp2
	JOIN pay.CalculationPersonel AS cp ON cp2.CalculationPersonelID = cp.CalculationPersonelID
	JOIN HRM.Personel p ON p.PersonelID = cp.PersonelID
	JOIN CFG.Party pa ON p.PartyID = pa.PartyID
	WHERE cp.VoucherID IS NOT NULL

	IF EXISTS (SELECT 1 FROM #CalculationPersonelWithoutVoucher )
	BEGIN
		IF @returnError = 1
		BEGIN
		    SELECT  * FROM #CalculationPersonelWithoutVoucher;
			RETURN;
		END;
		ELSE
		BEGIN
			--RAISERROR (N'PayrollManager.Calculation.GetExcelForCalculationPersonelWithoutVoucher', 16, 10);
			RAISERROR (N' در ماه انتخاب شده برای برخی از ردیفهای انتخاب شده،  سند صادر شده است.', 16, 10);
			RETURN;
		END
	END
END

IF  @Type = 3
BEGIN
	SELECT   
			p.Code,
			pa.Title + '' + pa.LastName as title 
	INTO #CalculationPersonelWithoutTimeSheet
	FROM #CalculationPersonel  AS cp2
	JOIN pay.CalculationPersonel AS cp ON cp2.CalculationPersonelID = cp.CalculationPersonelID
	JOIN #PersonelLastAccGroup plag ON cp.PersonelID = plag.PersonelID
	JOIN HRM.Personel p ON p.PersonelID = cp.PersonelID
	JOIN CFG.Party pa ON p.PartyID = pa.PartyID
	LEFT JOIN pay.TimeSheetCalculationPersonel  AS tscr ON tscr.CalculationPersonelID = cp2.CalculationPersonelID
	WHERE plag.IsShareable = 1 AND tscr.TimeSheetCalculationPersonelID IS NULL
	
	IF EXISTS (SELECT 1 FROM #CalculationPersonelWithoutTimeSheet)
	BEGIN
		IF @returnError = 1
		BEGIN
		    SELECT  * FROM #CalculationPersonelWithoutVoucher;
			RETURN;
		END;
		ELSE
		BEGIN
			--RAISERROR (N'PayrollManager.Calculation.GetExcelForCalculationPersonelWithoutTimeSheet', 16, 10);
			RAISERROR (N' در ماه انتخاب شده برای برخی از ردیفهای انتخاب شده،  تسهیم انجام نشده است.', 16, 10);
			RETURN;
		END
	END
END