CREATE   PROC [PAY].[spLoanInsert]
    @Type TINYINT,
	@BaseParentID INT,
    @ParentID INT,
    @PersonelID INT,
    @ParameterID INT,
    @Number INT,
    @FacilitiesNumber NVARCHAR(100),
    @Date DATE,
    @TotalAmount DECIMAL(30, 4),
    @Settlement DECIMAL(30, 4),
    @InstallmentCount SMALLINT,
    @InstallmentAmount DECIMAL(30, 4),
    @CalendarMonthID INT,
    @TotalRound DECIMAL(30, 4),
    @RoundPayment TINYINT,
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @OrganizationItemID  INT,
    @PaymentSubjectID INT,
	@PettyCashCostItemID INT,
	@DebitCreditNoteItemID INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
BEGIN 
	SET NOCOUNT ON 
	IF @Type = 3
	   OR @CalendarMonthID IS NULL
	BEGIN
	    SET @CalendarMonthID = HRM.GetCalendarMonthID(@Date)
	    IF @CalendarMonthID IS NULL
	    BEGIN
	        RAISERROR(
	            'تاریخ وارد شده در محدوده تقویم کاریهای تعریف شده نیست.',
	            16,
	            12
	        )
	        RETURN
	    END
	END
	
	IF (@Number IS NULL)
	   OR @Number = 0
	    SET @Number = ISNULL(
	            (
	                SELECT MAX(l.Number)
	                FROM   PAY.Loan l
	                WHERE  (@Type = 1 AND l.[Type] = 1)
	                       OR  (@Type <> 1 AND l.[Type] <> 1)
	            ),
	            0
	        ) + 1
	
	IF EXISTS(
	       SELECT *
	       FROM   PAY.Loan l
	       WHERE  l.[Type] = @Type
	              AND l.Number = @Number
	   )
	BEGIN
	    RAISERROR('شماره نمی تواند تکراری باشد.', 16, 12)
	    RETURN
	END 
	
	IF EXISTS(
	       SELECT *
	       FROM    PAY.CalculationPersonel cp
	                   
	       WHERE  cp.CalculationTypeID = 1
	              AND cp.CalendarMonthID = @CalendarMonthID
	              AND cp.PersonelID = @PersonelID
	   )
	BEGIN
	    IF (@Type = 1)
	    BEGIN
	        RAISERROR(
	            'در ماه انتخاب شده به ازای کارمند انتخاب شده، محاسبه انجام شده است.نمی توان در این ماه به این کارمند وام تخصیص داد.',
	            16,
	            12
	        )
	        RETURN
	    END
	    ELSE 
	    IF (@Type = 2 OR @Type = 3)
	    BEGIN
	        RAISERROR(
	            'در ماه انتخاب شده به ازای کارمند انتخاب شده، محاسبه انجام شده است.نمی توان در این ماه برای این کارمند اصلاح وام انجام داد.',
	            16,
	            12
	        )
	        RETURN
	    END
	END 
	
	IF (@Type = 2)
	BEGIN
	    IF EXISTS (
	           SELECT *
	           FROM   PAY.Loan l
	           WHERE  l.[Type] = 2
	                  AND l.CalendarMonthID = @CalendarMonthID
	                  AND l.ParentID = @ParentID
	                  AND l.PersonelID = @PersonelID
	       )
	    BEGIN
	        RAISERROR(
	            'نمی توان در یک ماه، برای یک نفر و یک وام بیشتر از یک اصلاح از نوع قسط انجام داد.',
	            16,
	            12
	        )
	        RETURN
	    END
	END
	
	IF (@Type = 3)
	BEGIN
	    IF EXISTS (
	           SELECT *
	           FROM   PAY.Loan l
	           WHERE  l.[Type] = 3
	                  AND l.CalendarMonthID = @CalendarMonthID
	                  AND l.ParentID = @ParentID
	                  AND l.PersonelID = @PersonelID
	       )
	    BEGIN
	        RAISERROR(
	            'نمی توان در یک ماه، برای یک نفر و یک وام بیشتر از یک اصلاح از نوع مانده انجام داد.',
	            16,
	            12
	        )
	        RETURN
	    END
	END
	
	IF @Type <> 1
	BEGIN
	    SELECT @BaseParentID = l.BaseParentID
	    FROM   Pay.Loan l
	    WHERE  l.LoanID = @ParentID
	    
	    SELECT @OrganizationItemID = l.OrganizationItemID
	    FROM   Pay.Loan l
	    WHERE  l.LoanID = @ParentID
	END
	
	IF @Type = 2
	BEGIN
	    SELECT @TotalAmount = l.TotalAmount
	    FROM   Pay.Loan l
	    WHERE  l.LoanID = @ParentID
	END
	
	IF @Type = 3
	BEGIN
	    SELECT @TotalAmount = l.TotalAmount
	    FROM   Pay.Loan l
	    WHERE  l.LoanID = @ParentID
	    
	    SET @TotalAmount = @TotalAmount -@Settlement
	    SELECT @InstallmentAmount = l.InstallmentAmount
	    FROM   Pay.Loan l
	    WHERE  l.LoanID = @ParentID
	END
	
	IF @BaseParentID IS NULL
	    SET @BaseParentID = 0
	
	INSERT INTO [PAY].[Loan]
	  (
	    [Type],
	    BaseParentID,
	    [ParentID],
	    [PersonelID],
	    [ParameterID],
	    [Number],
	    [FacilitiesNumber],
	    [Date],
	    [TotalAmount],
	    [Settlement],
	    [InstallmentCount],
	    [InstallmentAmount],
	    [CalendarMonthID],
	    [TotalRound],
	    [RoundPayment],
	    [Description],
	    [Description2],
	    OrganizationItemID,
	    [Version],
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    PaymentSubjectID, PettyCashCostItemID, DebitCreditNoteItemID
	  )
	SELECT @Type,
	       @BaseParentID,
	       @ParentID,
	       @PersonelID,
	       @ParameterID,
	       @Number,
	       @FacilitiesNumber,
	       @Date,
	       @TotalAmount,
	       @Settlement,
	       @InstallmentCount,
	       @InstallmentAmount,
	       @CalendarMonthID,
	       @TotalRound,
	       @RoundPayment,
	       @Description,
	       @Description2,
	       @OrganizationItemID,
	       0,
	       @Creator,
	       @CreationDate,
	       @LastEditor,
	       @LastEditionDate,
	       @PaymentSubjectID, @PettyCashCostItemID, @DebitCreditNoteItemID
	
	DECLARE @ID INT
	SET @ID = SCOPE_IDENTITY()
	IF @Type = 1
	    UPDATE Pay.Loan
	    SET    BaseParentID = @ID
	    WHERE  LoanID = @ID
	
	-- Begin Return Select <- do not remove
	SELECT [LoanID],
	       [Version],
	       [Number]
	FROM   [PAY].[Loan]
	WHERE  [LoanID] = @ID 
	       -- End Return Select <- do not remove
END
