CREATE     PROC [FIN].[spPaymentCheqeFlowItemUpdate]
    @PaymentCheqeFlowItemID int,
    @PaymentCheqeFlowID int,
    @RowIndex smallint,
    @PaymentCheqeID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON  

	DECLARE @PreVoucherID int,
	        @Type tinyint,
			@Date date,
	        @PrePaymentCheqeID int,
			@PreBankAccountID int,
			@PreNumber nvarchar(100),
			@PreCheqeBookID int = null,
			@PreToday bit, 
			@PreVersion int,
			@BankAccountID int,
			@Today bit,
			@LastState tinyint,
			@CheqeBookID int = null,
			@MaxDate date,
			@Title nvarchar(256)

	select @PreVoucherID = PreVoucherID,
	       @Type = f.[Type],
		   @Date = f.[Date],
		   @PrePaymentCheqeID = i.PaymentCheqeID,
		   @PreBankAccountID = c.BankAccountID,
		   @PreNumber = c.Number,
		   @PreCheqeBookID = c.CheqeBookID,
		   @PreToday = t.Today,
		   @PreVersion = i.[Version]
	from FIN.PaymentCheqeFlowItem i
	join FIN.PaymentCheqeFlow f on i.PaymentCheqeFlowID = f.PaymentCheqeFlowID
	join FIN.PaymentCheqe c on i.PaymentCheqeID = c.PaymentCheqeID
	join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	where i.PaymentCheqeFlowItemID = @PaymentCheqeFlowItemID

	SELECT @BankAccountID = c.BankAccountID,
		   @CheqeBookID = c.CheqeBookID,
		   @Today = t.Today,
		   @LastState = c.LastState
	FROM FIN.PaymentCheqe c
	JOIN FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	WHERE c.PaymentCheqeID = @PaymentCheqeID


	if (@Version <> @PreVersion or @PreVoucherID is not null)
	RAISERROR('Version mismatch...', 16 , 10)	
			
	
	IF (@Type = 0)
	BEGIN

		if (@PrePaymentCheqeID <> @PaymentCheqeID)
		begin
			SELECT @MaxDate = MAX([Date]) FROM FIN.Reconciliation WHERE BankAccountID = @PreBankAccountID  
		
			IF (@Date <= @MaxDate)
			BEGIN
			
				SELECT @Title = d.Title FROM CFG.BankAccount b
				JOIN ACC.DL d on b.DlID = d.DLID
				WHERE b.BankAccountID = @PreBankAccountID
			
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				return
			END 

			if (@PreBankAccountID <> @BankAccountID)
			begin
				SELECT @MaxDate = MAX([Date]) FROM FIN.Reconciliation WHERE BankAccountID = @BankAccountID  
		
				IF (@Date <= @MaxDate)
				BEGIN
			
					SELECT @Title = d.Title FROM CFG.BankAccount b
					JOIN ACC.DL d on b.DlID = d.DLID
					WHERE b.BankAccountID = @BankAccountID
			
					RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
					return
				END  
			end
		end
	END
		
	IF (@Type = 1)
	BEGIN
		if (@PrePaymentCheqeID <> @PaymentCheqeID)
		begin
			if (@PreToday = 1)
			begin
				SELECT @MaxDate = MAX([Date]) FROM FIN.Reconciliation WHERE BankAccountID = @PreBankAccountID  
		
				IF (@Date <= @MaxDate)
				BEGIN
			
					SELECT @Title = d.Title FROM CFG.BankAccount b
					JOIN ACC.DL d on b.DlID = d.DLID
					WHERE b.BankAccountID = @PreBankAccountID
			
					RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
					return
				END  
			end

			if (@Today = 1)
			begin
				SELECT @MaxDate = MAX([Date]) FROM FIN.Reconciliation WHERE BankAccountID = @BankAccountID  
		
				IF (@Date <= @MaxDate)
				BEGIN
			
					SELECT @Title = d.Title FROM CFG.BankAccount b
					JOIN ACC.DL d on b.DlID = d.DLID
					WHERE b.BankAccountID = @BankAccountID
			
					RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
					return
				END  
			end
		end	
	END


	if (@PrePaymentCheqeID <> @PaymentCheqeID)
	begin
		if ((@LastState = 0 and @Type = 0) or (@LastState = 2 and @Type = 1))
		begin
			RAISERROR('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12) 
			return
		end	
	end
	    
		
	UPDATE [FIN].[PaymentCheqeFlowItem]
	SET    [RowIndex] = @RowIndex, 
		   [PaymentCheqeID] = @PaymentCheqeID,  
		   [Version] = @Version + 1,
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  [PaymentCheqeFlowItemID] = @PaymentCheqeFlowItemID
			
	
	IF (@PrePaymentCheqeID <> @PaymentCheqeID)
	BEGIN
	    
		DECLARE @LastAmount decimal(30, 4) = null,@Message nvarchar(MAX) = null
				
		IF (@Type = 0)
		BEGIN

			IF LOWER((select f.ConfigValue from CFG.Configuration f
			where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				
				SELECT @LastAmount = la.LastAmount,
					   @Title = d.Title
				FROM CFG.BankAccount ba
				JOIN ACC.DL d on ba.DlID = d.DLID
				JOIN CFG.BankAccount_LastAmount la on ba.BankAccountID = la.BankAccountID
				WHERE ba.BankAccountID = @BankAccountID
						
				IF (@LastAmount < 0)
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusBankAccount'
					AND lsv.Culture = cfg.GetuserCulture()
						
					SET @Message = REPLACE(@Message, '{0}', @Title)
					RAISERROR(@Message,16,12)
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
				 
			END
				
			UPDATE [FIN].[PaymentCheqe]
			SET    [LastState] = 1
			WHERE  [PaymentCheqeID] = @PrePaymentCheqeID
				
			UPDATE [FIN].[PaymentCheqe]
			SET    [LastState] = 0
			WHERE  [PaymentCheqeID] = @PaymentCheqeID
				
		END
			
		IF (@Type = 1)
		BEGIN
				
			if(@PreToday = 1)
			begin
					
				IF LOWER((select f.ConfigValue from CFG.Configuration f
				where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
				BEGIN
						
					SELECT @LastAmount = la.LastAmount,
						   @Title = d.Title
					FROM CFG.BankAccount ba
					JOIN ACC.DL d on ba.DlID = d.DLID
					JOIN CFG.BankAccount_LastAmount la on ba.BankAccountID = la.BankAccountID
					WHERE ba.BankAccountID = @PreBankAccountID
							
					IF (@LastAmount < 0)
					BEGIN
						SELECT @Message = lsv.[Value]
						FROM cfg.LocalizationSQLMessage ls
						JOIN cfg.LocalizationSQLMessageValue lsv 
						ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
						WHERE ls.SQLMessageCode = 'MinusBankAccount'
						AND lsv.Culture = cfg.GetuserCulture()
							
						SET @Message = REPLACE(@Message, '{0}', @Title)
						RAISERROR(@Message,16,12)
						--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
					END
					 
				END
					
				UPDATE [FIN].[PaymentCheqe]
				SET    [LastState] = 0
				WHERE  [PaymentCheqeID] = @PrePaymentCheqeID
					
			end				
			else
			begin
				
				UPDATE [FIN].[PaymentCheqe]
				SET    [LastState] = 1
				WHERE  [PaymentCheqeID] = @PrePaymentCheqeID
					
			end
	
			UPDATE [FIN].[PaymentCheqe]
			SET    [LastState] = 2
			WHERE  [PaymentCheqeID] = @PaymentCheqeID			
					
			IF (@PreCheqeBookID IS NOT NULL)
			BEGIN
					
				if ((select c.[Status] from FIN.CheqeBook c where c.CheqeBookID = @PreCheqeBookID) = 2)
				begin
				    raiserror('چک شماره (%s) ابطال شده، به همین دلیل قابل تعویض نیست.',16,12,@PreNumber)
					return
				end
					
				UPDATE [FIN].[CheqeBook]
				SET [Status] = 1
				WHERE [CheqeBookID] = @PreCheqeBookID 
						
			END													
					
			IF (@CheqeBookID IS NOT NULL)
			BEGIN
					
				UPDATE [FIN].[CheqeBook]
				SET [Status] = 0
				WHERE [CheqeBookID] = @CheqeBookID 
						
			END
												
		END

	END
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[PaymentCheqeFlowItem]
	WHERE  [PaymentCheqeFlowItemID] = @PaymentCheqeFlowItemID	
	-- End Return Select <- do not remove	
