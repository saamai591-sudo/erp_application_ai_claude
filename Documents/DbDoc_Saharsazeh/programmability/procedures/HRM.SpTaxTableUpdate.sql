CREATE PROC [HRM].[SpTaxTableUpdate] 
    @TaxTableID INT,
    @TaxTableTypeID INT,
    @CalendarMonthID INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 
    DECLARE @OldCalendarMonthID INT

    SELECT @OldCalendarMonthID = CalendarMonthID
    FROM   hrm.TaxTable
    WHERE  TaxTableID = @TaxTableID

    IF (PAY.HasCalculation(-1, @OldCalendarMonthID) = 1)
    BEGIN
        RAISERROR('در ماه مورد نظر محاسبه انجام شده است', 16, 12)
        RETURN
    END
	
    IF (PAY.HasCalculation(-1, @CalendarMonthID) = 1)
    BEGIN
        RAISERROR('در ماه مورد نظر محاسبه انجام شده است', 16, 12)
        RETURN
    END
	
    IF @Version = (
           SELECT [Version]
           FROM   [HRM].[TaxTable]
           WHERE  [TaxTableID] = @TaxTableID
       )
    BEGIN
        UPDATE [HRM].[TaxTable]
        SET    [TaxTableTypeID] = @TaxTableTypeID,
               [CalendarMonthID] = @CalendarMonthID,
               [Version] = @Version,
               [Creator] = @Creator,
               [CreationDate] = @CreationDate,
               [LastEditor] = @LastEditor,
               [LastEditionDate] = @LastEditionDate
        WHERE  [TaxTableID] = @TaxTableID
    
        -- Begin Return Select <- do not remove
        SELECT  [Version]
        FROM   [HRM].[TaxTable]
        WHERE  [TaxTableID] = @TaxTableID 
               -- End Return Select <- do not remove
    END
