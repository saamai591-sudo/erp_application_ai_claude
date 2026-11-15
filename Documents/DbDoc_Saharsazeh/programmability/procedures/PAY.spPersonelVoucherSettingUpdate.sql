CREATE     PROC [PAY].[spPersonelVoucherSettingUpdate]
    @PersonelVoucherSettingID INT,
    @PersonelID INT,
    @CalendarMonthID INT,
    @PayrollAccGroupID TINYINT,
    @MissionOrganizationDlId BIGINT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
    SET NOCOUNT ON 

    IF EXISTS (
           SELECT 1
           FROM   pay.PersonelVoucherSetting AS pvs
           WHERE  pvs.PersonelID = @PersonelID
                  AND pvs.CalendarMonthID = @CalendarMonthID
                  AND pvs.PersonelVoucherSettingID <> @PersonelVoucherSettingID
       )
    BEGIN
        RAISERROR('اطلاعات وارد شده تکراری می باشد.', 16, 12)
        RETURN
    END

    IF EXISTS(
           SELECT 1
           FROM   pay.CalculationPersonel      AS cv
                  INNER JOIN HRM.CalendarMonth AS cm
                       ON  cm.CalendarMonthID = cv.CalendarMonthID
           WHERE  cv.PersonelID = @PersonelID
                  AND cm.StartDate >= (
                          SELECT cm2.StartDate
                          FROM   hrm.CalendarMonth AS cm2
                          WHERE  cm2.CalendarMonthID = @CalendarMonthID
                      )  and cv.VoucherID is not null
       )
    BEGIN
        RAISERROR('به دلیل صدور سند امکان تغییر اطلاعات نمی باشد.', 16, 12)
        RETURN
    END

    IF @Version = (
           SELECT [Version]
           FROM   [PAY].[PersonelVoucherSetting]
           WHERE  [PersonelVoucherSettingID] = @PersonelVoucherSettingID
       )
    BEGIN
        SET @Version = @Version + 1 
    
        UPDATE [PAY].[PersonelVoucherSetting]
        SET    [PersonelID] = @PersonelID,
               [CalendarMonthID] = @CalendarMonthID,
               [PayrollAccGroupID] = @PayrollAccGroupID,
               [MissionOrganizationDlId] = @MissionOrganizationDlId,
               [Version] = @Version,
               [Creator] = @Creator,
               [CreationDate] = @CreationDate,
               [LastEditor] = @LastEditor,
               [LastEditionDate] = @LastEditionDate
        WHERE  [PersonelVoucherSettingID] = @PersonelVoucherSettingID
    
        -- Begin Return Select <- do not remove
        SELECT  [Version]
        FROM   [PAY].[PersonelVoucherSetting]
        WHERE  [PersonelVoucherSettingID] = @PersonelVoucherSettingID 
               -- End Return Select <- do not remove
    END
    ELSE
        RAISERROR('Version mismatch...', 16, 10)
