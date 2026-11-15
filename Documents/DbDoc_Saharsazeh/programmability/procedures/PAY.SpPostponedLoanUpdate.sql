CREATE     PROC [PAY].[SpPostponedLoanUpdate]
    @PostponedLoanID int,
    @PostponeID int,
    @LoanID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 

	if @Version <> (Select [Version] from [PAY].[PostponedLoan]
				where [PostponedLoanID] = @PostponedLoanID)
	RAISERROR('Version mismatch...', 16 , 10)

	DECLARE @personelID INT,@StartCalendarMonth int,@EndCalendarMonth int
	
	SELECT @personelID = l.PersonelID FROM pay.Loan l
	WHERE l.LoanID=@LoanID
	
	SELECT @StartCalendarMonth = p.StartCalendarMonthID,
	       @EndCalendarMonth = p.EndCalendarMonthID
	FROM pay.PostPone p
	WHERE p.PostPoneID = @PostponeID
	
	IF EXISTS (SELECT * FROM pay.CalculationPersonel cp 
	WHERE cp.PersonelID = @personelID AND cp.CalendarMonthID = @StartCalendarMonth)
    BEGIN
   		 RAISERROR('در ماه انتخاب شده محاسبه انجام شده، نمی توان در این ماه تعلیق صادر کرد.',16,12)
   		 return
    END
    
    IF EXISTS (SELECT * FROM PAY.PostponedLoan pl
    INNER JOIN PAY.Postpone p on p.PostponeID = pl.PostponeID
    INNER JOIN HRM.CalendarMonth cm on cm.CalendarMonthID = p.StartCalendarMonthID
    WHERE pl.LoanID = @LoanID and 
    ((cm.MonthNumber = 1 and @StartCalendarMonth BETWEEN p.StartCalendarMonthID - 1 and p.EndCalendarMonthID) or
    (cm.MonthNumber <> 1 and @StartCalendarMonth BETWEEN p.StartCalendarMonthID and p.EndCalendarMonthID) or
    (cm.MonthNumber = 1 and @EndCalendarMonth BETWEEN p.StartCalendarMonthID - 1 and p.EndCalendarMonthID) or
    (cm.MonthNumber <> 1 and @EndCalendarMonth BETWEEN p.StartCalendarMonthID and p.EndCalendarMonthID)) and
    pl.PostponedLoanID <> @PostponedLoanID)
    BEGIN
   		 RAISERROR('در یک ماه برای یک وام بیشتر از یک تعلیق نمی توان صادر کرد.',16,12)
   		 return
    END

	set @Version = @Version +1 

	UPDATE [PAY].[PostponedLoan]
	SET    [PostponeID] = @PostponeID, [LoanID] = @LoanID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [PostponedLoanID] = @PostponedLoanID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [PAY].[PostponedLoan]
	WHERE  [PostponedLoanID] = @PostponedLoanID	
	-- End Return Select <- do not remove
