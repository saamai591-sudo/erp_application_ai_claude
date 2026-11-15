CREATE   PROC [PAY].[spPersonelVoucherSettingDelete]
    @PersonelVoucherSettingID INT,@Version INT
AS 
SET NOCOUNT ON 

DECLARE @PersonelID INT,@CalendarMonthID INT

SELECT @PersonelID=pvs.PersonelID,@CalendarMonthID=pvs.CalendarMonthID
  FROM pay.PersonelVoucherSetting AS pvs
WHERE pvs.PersonelVoucherSettingID=@PersonelVoucherSettingID
	
IF EXISTS(
       SELECT 1
       FROM   pay.CalculationPersonel     AS cv
              INNER JOIN HRM.CalendarMonth AS cm
                   ON  cm.CalendarMonthID = cv.CalendarMonthID
       WHERE  cv.PersonelID = @PersonelID
              AND cm.StartDate >= (
                      SELECT cm2.StartDate
                      FROM   hrm.CalendarMonth AS cm2
                      WHERE  cm2.CalendarMonthID = @CalendarMonthID
                  )
				  and cv.VoucherID is not null
   )
BEGIN
    RAISERROR('به دلیل صدور سند امکان حذف اطلاعات نمی باشد.', 16, 12)
    RETURN
END

IF @Version = (
       SELECT [Version]
       FROM   [PAY].[PersonelVoucherSetting]
       WHERE  [PersonelVoucherSettingID] = @PersonelVoucherSettingID
   )
BEGIN
    DELETE 
    FROM   [PAY].[PersonelVoucherSetting]
    WHERE  [PersonelVoucherSettingID] = @PersonelVoucherSettingID
END
ELSE
BEGIN
    RAISERROR (
        N'Delete_%s_%d.',	-- Message text.
        16,	-- Severity,
        10,	-- State,
        N'PersonelVoucherSetting',	-- First argument.
        @PersonelVoucherSettingID
    ); -- Second argument.)
END
