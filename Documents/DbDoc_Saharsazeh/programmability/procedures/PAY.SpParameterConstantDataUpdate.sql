
CREATE PROC [PAY].[SpParameterConstantDataUpdate] 
    @ParameterConstantDataID INT,
    @ParameterID INT,
    @PersonnelID INT,
    @CalendarMonthID INT,
    @Value DECIMAL(30, 4),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 

SET NOCOUNT ON 

IF @Version <> (
       SELECT [Version]
       FROM   [PAY].[ParameterConstantData]
       WHERE  [ParameterConstantDataID] = @ParameterConstantDataID
   )
    RAISERROR('Version mismatch...', 16, 10)


SET @Version = @Version + 1 

IF Pay.HasCalculationAfter(@PersonnelID, @CalendarMonthID,@ParameterID) = 1
BEGIN
    RAISERROR (
        N'براي اين اطلاعات محاسبه انجام شده است',	-- Message text.
        16,	-- Severity,
        12
    ); -- Second argument.)
    
    RETURN
END
		
IF EXISTS (
       SELECT pcd.ParameterConstantDataID
       FROM   pay.ParameterConstantData pcd
       WHERE  pcd.PersonnelID = @PersonnelID
              AND pcd.ParameterID = @ParameterID
              AND pcd.CalendarMonthID = @CalendarMonthID
              AND pcd.ParameterConstantDataID<>@ParameterConstantDataID
   )
BEGIN
    BEGIN
    	RAISERROR (
    	    N'اطلاعات وارد شده تکراري مي باشد',	-- Message text.
    	    16,	-- Severity,
    	    12
    	); -- Second argument.)
    	   --RAISERROR('تاريخ وارد شده در محدوده تقويم کاريهاي تعريف شده نيست.',16,12)
    	RETURN
    END
END
	
		
DECLARE @OldPersonelID          INT,
        @OldCalendarMonthID     INT,
        @oldParameterID  Int
	
SELECT @OldPersonelID = pcd.PersonnelID,
       @OldCalendarMonthID = pcd.CalendarMonthID,
       @oldParameterID=pcd.ParameterID
FROM   pay.ParameterConstantData pcd
WHERE  pcd.ParameterConstantDataID = @ParameterConstantDataID
		
IF Pay.HasCalculationAfter(@OldPersonelID, @OldCalendarMonthID,@oldParameterID) = 1
BEGIN
    RAISERROR (
        N'براي اين اطلاعات محاسبه انجام شده است',	-- Message text.
        16,	-- Severity,
        12
    ); -- Second argument.)
    
    RETURN
END
		
		

UPDATE [PAY].[ParameterConstantData]
SET    [ParameterID] = @ParameterID,
       [PersonnelID] = @PersonnelID,
       [CalendarMonthID] = @CalendarMonthID,
       [Value] = @Value,
       [Version] = @Version,
       [Creator] = @Creator,
       [CreationDate] = @CreationDate,
       [LastEditor] = @LastEditor,
       [LastEditionDate] = @LastEditionDate
WHERE  [ParameterConstantDataID] = @ParameterConstantDataID
	
		-- Begin Return Select <- do not remove
SELECT  [Version]
FROM   [PAY].[ParameterConstantData]
WHERE  [ParameterConstantDataID] = @ParameterConstantDataID 
       -- End Return Select <- do not remove
