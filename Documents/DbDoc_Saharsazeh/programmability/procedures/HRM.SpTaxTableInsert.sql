CREATE PROC [HRM].[SpTaxTableInsert] 
    @TaxTableTypeID INT,
    @CalendarMonthID INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 

    IF (PAY.HasCalculation(-1, @CalendarMonthID)= 1)
	    BEGIN
		    RAISERROR('در ماه مورد نظر محاسبه انجام شده است',16,12)
		    RETURN
	    END

    INSERT INTO [HRM].[TaxTable]
      (
        [TaxTableTypeID],
        [CalendarMonthID],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @TaxTableTypeID,
           @CalendarMonthID,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
	    -- Begin Return Select <- do not remove
    SELECT [TaxTableID],
           [Version]
    FROM   [HRM].[TaxTable]
    WHERE  [TaxTableID] = SCOPE_IDENTITY()
           -- End Return Select <- do not remove
