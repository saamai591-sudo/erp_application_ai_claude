CREATE     PROC [PAY].[spPersonelVoucherSettingInsert]
    @PersonelID INT,
    @CalendarMonthID INT,
    @PayrollAccGroupID TINYINT,
    @MissionOrganizationDlId BIGINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
    SET NOCOUNT ON 

    IF EXISTS ( SELECT 1 FROM pay.PersonelVoucherSetting AS pvs
                WHERE pvs.PersonelID=@PersonelID
			    AND pvs.CalendarMonthID=@CalendarMonthID)
    BEGIN
	     RAISERROR('اطلاعات وارد شده تکراری می باشد.', 16, 12)
	    return
    END

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
        RAISERROR('به دلیل صدور سند امکان درج اطلاعات نمی باشد.', 16, 12)
        RETURN
    END
	
    INSERT INTO [PAY].[PersonelVoucherSetting]
      (
        [PersonelID],
        [CalendarMonthID],
        [PayrollAccGroupID],
        [MissionOrganizationDlId],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @PersonelID,
           @CalendarMonthID,
           @PayrollAccGroupID,
           @MissionOrganizationDlId,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
	-- Begin Return Select <- do not remove
    SELECT [PersonelVoucherSettingID],
           [Version]
    FROM   [PAY].[PersonelVoucherSetting]
    WHERE  [PersonelVoucherSettingID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
