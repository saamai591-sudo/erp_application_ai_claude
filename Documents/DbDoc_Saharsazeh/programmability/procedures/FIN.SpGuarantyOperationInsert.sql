
--==============================================Alter SpGuarantyOperationInsert
CREATE   PROC [FIN].[SpGuarantyOperationInsert] 
    @BranchID INT,
    @CommitmentType TINYINT,
    @Number INT,
    @date DATE,
    @PaymentGuarantyCommitmentID INT = NULL,
    @ReceiveGuarantyCommitmentID INT = NULL,
    @OperationType TINYINT,
    @DueDate DATE = NULL,
    @DeductedAmount DECIMAL(30, 4),
    @BankAccountID INT = NULL,
    @DraftNumber NVARCHAR(50) = NULL,
	@SlID INT = NULL,
	@CurrencyRate DECIMAL(20, 10) = NULL,
    @Description NVARCHAR(250) = NULL,
    @Description2 NVARCHAR(250) = NULL,
    @PreVoucherID INT = NULL,
    @FinancialPeriodID INT,
    @Creator INT,
    @CreationDate DATETIME
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	DECLARE 
		@FinalID INT = NULL,
		@FinalDate DATE = NULL,
		@FinalDateString NVARCHAR(100) = NULL,
		@GuarantyAmount DECIMAL(30, 4),
		@SumDeductedAmount DECIMAL(30, 4),
		@FinalDeductedAmount DECIMAL(30, 4),
		@Message NVARCHAR(MAX) = NULL,
		@s NVARCHAR(MAX)
	
	IF (@OperationType = 4)
	BEGIN
		DECLARE 
			@MaxDate DATE

		SELECT 
			@MaxDate = MAX(r.[Date]) 
		FROM 
			FIN.Reconciliation r 
		WHERE 
			r.BankAccountID = @BankAccountID  
		
		IF (@date <= @MaxDate)
		BEGIN
			DECLARE 
				@Title NVARCHAR(256)
			
			SELECT 
				@Title = d.Title 
			FROM 
				CFG.BankAccount b
			JOIN 
				ACC.DL d 
			ON 
				b.DlID = d.DLID
			WHERE 
				b.BankAccountID = @BankAccountID
			
			RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.', 16, 12, @Title) 
			RETURN
		END
	END
    
	IF (@OperationType = 1)
    BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			SELECT 
				@FinalID = T.GuarantyOperationID,
			    @FinalDate =  T.DueDate
			FROM 
			(
				SELECT 
					ROW_NUMBER() OVER(PARTITION BY ReceiveGuarantyCommitmentID ORDER BY GuarantyOperationID DESC) 
					RowNumber,
					*
				FROM 
					FIN.GuarantyOperation g
				WHERE 
					g.CommitmentType = 1 AND
					g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND
					g.OperationType = 1 
			) AS T
			WHERE 
				T.RowNumber = 1
			
			IF (@FinalID IS NOT NULL)
			BEGIN
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate, 0)
			
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.', 16, 12, @FinalDateString)
					RETURN
				END
			END
			ELSE
			BEGIN
				SELECT 
					@FinalDate = r.[Date] 
				FROM 
					FIN.ReceiveGuarantyCommitment r 
				WHERE 
					r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
				
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate, 0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN 
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.', 16, 12, @FinalDateString)
					RETURN
				END
			END
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			
			SELECT 
				@FinalID = T.GuarantyOperationID,
			    @FinalDate = T.DueDate
			FROM 
			(
				SELECT 
					ROW_NUMBER() OVER(PARTITION BY PaymentGuarantyCommitmentID ORDER BY GuarantyOperationID DESC) 
					RowNumber,
					*
				FROM 
					FIN.GuarantyOperation g
				WHERE 
					g.CommitmentType = 2 AND
					g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND
					g.OperationType = 1
			) AS T
			WHERE 
				T.RowNumber = 1
			
			IF (@FinalID IS NOT NULL)
			BEGIN
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate, 0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.', 16, 12, @FinalDateString)
					RETURN
				END
			END
			ELSE
			BEGIN
				SELECT 
					@FinalDate = p.[Date] 
				FROM 
					FIN.PaymentGuarantyCommitment p
				WHERE 
					p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
				
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate, 0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.', 16, 12, @FinalDateString)
					RETURN
				END
			END
		END
	END
    
	IF (@OperationType = 2)
    BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			SELECT 
				@GuarantyAmount = r.Amount 
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
	
			SELECT 
				@SumDeductedAmount = SUM(CASE WHEN OperationType = 2 THEN -g.DeductedAmount 
										 WHEN OperationType = 5 THEN g.DeductedAmount END)
			FROM 
				FIN.GuarantyOperation g
		    WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND 
				g.OperationType IN (2, 5)
		    
		    SET 
				@FinalDeductedAmount = @GuarantyAmount + ISNULL(@SumDeductedAmount, 0) 
			
			IF (@DeductedAmount >= @FinalDeductedAmount)
			BEGIN
				SET 
					@s = 'مبلغ نهایی ضمانت نامه ' + CAST(@FinalDeductedAmount AS VARCHAR(100)) + ' است. مبلغ کسر شده باید کوچکتر از مبلغ نهایی ضمانت نامه باشد.'

				RAISERROR(@s, 16, 12)
				RETURN
			END
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			SELECT 
				@GuarantyAmount = p.Amount 
			FROM 
				FIN.PaymentGuarantyCommitment p
			WHERE 
				p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = SUM(CASE WHEN OperationType = 2 THEN -g.DeductedAmount 
										 WHEN OperationType = 5 THEN g.DeductedAmount END)
			FROM 
				FIN.GuarantyOperation g
		    WHERE
				g.CommitmentType = 2 AND 
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND 
				g.OperationType IN (2, 5)
		   
		    SET 
				@FinalDeductedAmount = @GuarantyAmount + ISNULL(@SumDeductedAmount, 0)
			
			IF (@DeductedAmount >= @FinalDeductedAmount)
			BEGIN
				SET @s = 'مبلغ نهایی ضمانت نامه ' + CAST(@FinalDeductedAmount AS VARCHAR(100)) + ' است. مبلغ کسر شده باید کوچکتر از مبلغ نهایی ضمانت نامه باشد.'

				RAISERROR(@s, 16, 12)
				RETURN
			END
		END
	END
	
	DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		CFG.Branch b 
	WHERE 
		b.BranchID = @BranchID
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
							FROM 
								[FIN].[GuarantyOperation] GuarantyOperation
							JOIN 
								CFG.Branch b 
							ON 
								GuarantyOperation.BranchID = b.BranchID
							WHERE 
								GuarantyOperation.FinancialPeriodID = @FinancialPeriodID AND 
								b.CompanyID = @CompanyID)
						, 1) 
			
	INSERT INTO 
		[FIN].[GuarantyOperation] ([BranchID], [CommitmentType], [Number], [date], [PaymentGuarantyCommitmentID], [ReceiveGuarantyCommitmentID], [OperationType], [DueDate], [DeductedAmount], [BankAccountID], [DraftNumber], [SlID], [CurrencyRate], [Description], [Description2], [PreVoucherID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT 
		@BranchID, @CommitmentType, @Number, @date, @PaymentGuarantyCommitmentID, @ReceiveGuarantyCommitmentID, @OperationType, @DueDate, @DeductedAmount, @BankAccountID, @DraftNumber,@SlID, @CurrencyRate, @Description, @Description2, @PreVoucherID, @FinancialPeriodID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT 
		[GuarantyOperationID], 
		[Version], 
		[Number]
	FROM   
		[FIN].[GuarantyOperation]
	WHERE  
		[GuarantyOperationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	IF (@OperationType = 3)
	BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 2
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment
			SET 
				LastState = 2
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
		END
	END
	
	IF (@OperationType = 4)
	BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 3
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment
			SET 
				LastState = 3
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				DECLARE 
					@LastAmount DECIMAL(30, 4),
					@DlTitle NVARCHAR(256)
				
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					CFG.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @BankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
		END
	END
