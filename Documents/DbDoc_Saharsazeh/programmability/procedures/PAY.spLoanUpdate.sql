CREATE   PROC [PAY].[spLoanUpdate] 
    @LoanID INT,
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
    @OrganizationItemID INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @PaymentSubjectID INT,
	@PettyCashCostItemID INT, 
	@DebitCreditNoteItemID INT
	--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	IF @Version = (
	       SELECT [Version]
	       FROM   [PAY].[Loan]
	       WHERE  [LoanID] = @LoanID
	   )
	BEGIN

	    IF @Type = 3
	    BEGIN
	        SET @CalendarMonthID = HRM.GetCalendarMonthID(@Date)
	        IF @CalendarMonthID IS NULL
	        BEGIN
	            RAISERROR(
	                'تاريخ وارد شده در محدوده تقويم کاريهاي تعريف شده نيست.',
	                16,
	                12
	            )
	            RETURN
	        END
	    END
	    
	    IF EXISTS(
	           SELECT *
	           FROM   PAY.Loan l
	           WHERE  l.[Type] = @Type
	                  AND l.Number = @Number
	                  AND l.LoanID <> @LoanID
	       )
	    BEGIN
	        RAISERROR('شماره نمي تواند تکراري باشد.', 16, 12)
	        RETURN
	    END
	    
	    IF EXISTS(
	           SELECT *
	           FROM   PAY.CalculationPersonel cp
	           WHERE  cp.CalculationTypeID = 1
	                  AND cp.CalendarMonthID = @CalendarMonthID
	                  AND cp.PersonelID = @PersonelID
	       )
	    BEGIN
	        IF (@Type = 1)
	        BEGIN
	            RAISERROR(
	                'در ماه انتخاب شده به ازاي کارمند انتخاب شده، محاسبه انجام شده است.نمي توان در اين ماه به اين کارمند وام تخصيص داد.',
	                16,
	                12
	            )
	            RETURN
	        END
	        ELSE 
	        IF (@Type = 2 OR @Type = 3)
	        BEGIN
	            RAISERROR(
	                'در ماه انتخاب شده به ازاي کارمند انتخاب شده، محاسبه انجام شده است.نمي توان در اين ماه براي اين کارمند اصلاح وام انجام داد.',
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
	                      AND l.LoanID <> @LoanID
	           )
	        BEGIN
	            RAISERROR(
	                'نمي توان در يک ماه، براي يک نفر و يک وام بيشتر از يک اصلاح از نوع قسط انجام داد.',
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
	                      AND l.LoanID <> @LoanID
	           )
	        BEGIN
	            RAISERROR(
	                'نمي توان در يک ماه، براي يک نفر و يک وام بيشتر از يک اصلاح از نوع مانده انجام داد.',
	                16,
	                12
	            )
	            RETURN
	        END
	    END
	    
	    SET @BaseParentID = @LoanID
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
	    
	    IF (@Type <> 1)
	    BEGIN
	        DECLARE @Remain        DECIMAL(30, 4),
	                @Remainint     INT
	        
	        SELECT @Remain = l.TotalAmount - ISNULL(calc.value, 0) + l.Settlement
	        FROM   PAY.Loan l
	               LEFT JOIN (
	                        SELECT c.LoanID,
	                               SUM(c.Value) VALUE
	                        FROM   PAY.CalculationResult c
	                        WHERE  c.LoanID IS NOT NULL
	                               AND c.ParameterValueTypeID = 7
	                        GROUP BY
	                               LoanID
	                    )calc
	                    ON  calc.LoanID = l.BaseParentID
	        WHERE  l.LoanID = @LOanID
	        
	        IF (@Type = 2 AND @InstallmentAmount > @Remain)
	        BEGIN
	            SET @Remainint = CONVERT(INT, @Remain)
	            RAISERROR(
	                'مانده وام (%d) مي باشد.مبلغ قسط نمي تواند بيشتر از مبلغ مانده وام باشد.',
	                16,
	                12,
	                @Remainint
	            )
	            RETURN
	        END
	        
	        IF (@Type = 3 AND @Settlement > @Remain)
	        BEGIN
	            SET @Remainint = CONVERT(INT, @Remain)
	            RAISERROR(
	                'مانده وام (%d) مي باشد.مبلغ تسويه دستي نمي تواند بيشتر از مبلغ مانده وام باشد.',
	                16,
	                12,
	                @Remainint
	            )
	            RETURN
	        END
	    END
	    
	    UPDATE [PAY].[Loan]
	    SET    [Type] = @Type,
	           [ParentID] = @ParentID,
	           [PersonelID] = @PersonelID,
	           [ParameterID] = @ParameterID,
	           [Number] = @Number,
	           [FacilitiesNumber] = @FacilitiesNumber,
	           [Date] = @Date,
	           [TotalAmount] = @TotalAmount,
	           [Settlement] = @Settlement,
	           [InstallmentCount] = @InstallmentCount,
	           [InstallmentAmount] = @InstallmentAmount,
	           [CalendarMonthID] = @CalendarMonthID,
	           [TotalRound] = @TotalRound,
	           [RoundPayment] = @RoundPayment,
	           [Description] = @Description,
	           OrganizationItemID = @OrganizationItemID,
	           [Description2] = @Description2,
	           [Version] = @Version,
	           [Creator] = @Creator,
	           [CreationDate] = @CreationDate,
	           [LastEditor] = @LastEditor,
	           [LastEditionDate] = @LastEditionDate,
	           BaseParentID = @BaseParentID,
	           PaymentSubjectID = @PaymentSubjectID,
	           PettyCashCostItemID = @PettyCashCostItemID,
	           DebitCreditNoteItemID = @DebitCreditNoteItemID
	    WHERE  [LoanID] = @LoanID
	    
	    -- Begin Return Select <- do not remove
	    SELECT  [Version],
	           [Number]
		FROM   [PAY].[Loan]
	    WHERE  [LoanID] = @LoanID 
		-- End Return Select <- do not remove
END
