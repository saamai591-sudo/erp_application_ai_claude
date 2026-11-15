CREATE     PROC [PAY].[SpPostponeUpdate]
    @PostponeID INT,
    @Number INT,
    @Date DATE,
    @StartCalendarMonthID INT,
    @EndCalendarMonthID INT,
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
	       FROM   [PAY].[Postpone]
	       WHERE  [PostponeID] = @PostponeID
	   )
	    RAISERROR('Version mismatch...', 16, 10)
	
	DECLARE @Old_StartCalendarMonthID     INT,
	        @Old_EndCalendarMonthID       INT
	
	SELECT @Old_StartCalendarMonthID = p.StartCalendarMonthID,
	       @Old_EndCalendarMonthID = p.EndCalendarMonthID
	FROM   pay.Postpone AS p
	WHERE  p.PostponeID = @PostponeID
	
	IF @Old_StartCalendarMonthID <> @StartCalendarMonthID
	   OR @Old_EndCalendarMonthID = @EndCalendarMonthID
	BEGIN
	    DECLARE @StartDate1     DATETIME,
	            @StartDate2     DATETIME,
	            @EndDate1       DATETIME,
	            @EndDate2       DATETIME
	    
	    SELECT @StartDate1 = StartDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.CalendarMonthID = @StartCalendarMonthID
	    
	    SELECT @StartDate2 = StartDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.CalendarMonthID = @Old_StartCalendarMonthID
	    
	    SELECT @EndDate1 = EndDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.CalendarMonthID = @EndCalendarMonthID
	    
	    SELECT @EndDate2 = EndDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.CalendarMonthID = @Old_EndCalendarMonthID
	    
	    IF EXISTS (
	           SELECT *
	           FROM   pay.CalculationPersonel cp
	                       JOIN hrm.CalendarMonth AS cm ON cp.CalendarMonthID=cm.CalendarMonthID
	                  INNER JOIN (
	                           SELECT l.PersonelID
	                           FROM   pay.PostponedLoan pl
	                                  INNER JOIN pay.Loan l
	                                       ON  l.LoanID = pl.LoanID
	                           WHERE  pl.PostponeID = @PostponeID
	                       )pl
	                       ON  pl.PersonelID = cp.PersonelID
	           WHERE  cp.CalculationTypeID = 1
	                  AND cm.StartDate BETWEEN CASE 
	                                                WHEN @StartDate1 <@StartDate2 THEN @StartDate1
	                                                ELSE @StartDate2
	                                           END
	                      AND   CASE 
	                                 WHEN @EndDate1 <@EndDate2 THEN @EndDate2
	                                 ELSE @EndDate1
	                            END
	       )
	    BEGIN
	        RAISERROR(
	            'در ماه انتخاب شده محاسبه انجام شده، نمی توان تعلیق صادر شده در این ماه را ویرایش کرد.',
	            16,
	            12
	        )
	        RETURN
	    END
	END
	
	SET @Version = @Version + 1 
	
	UPDATE [PAY].[Postpone]
	SET    [Number] = @Number,
	       [Date] = @Date,
	       [StartCalendarMonthID] = @StartCalendarMonthID,
	       [EndCalendarMonthID] = @EndCalendarMonthID,
	       [Version] = @Version,
	       [Creator] = @Creator,
	       [CreationDate] = @CreationDate,
	       [LastEditor] = @LastEditor,
	       [LastEditionDate] = @LastEditionDate
	WHERE  [PostponeID] = @PostponeID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
    FROM   [PAY].[Postpone]
	WHERE  [PostponeID] = @PostponeID 
	-- End Return Select <- do not remove
