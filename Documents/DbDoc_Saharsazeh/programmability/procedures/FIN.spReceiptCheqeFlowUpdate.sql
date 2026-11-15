
CREATE PROC [FIN].[spReceiptCheqeFlowUpdate] 
    @ReceiptCheqeFlowID int,
    @FinancialPeriodID int,
    @Type tinyint,
    @BranchID int,
    @Date date,
    @Number nvarchar(50),
    @BankAccountID int,
    @CashID int,
    @PartyID bigint,
    @Status tinyint,
    @InnerNumber int,
    @PreVoucherID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON  

	DECLARE @prePrevoucherID INT,@PreVersion INT
	
	SELECT @PreVersion = [Version],
		   @prePrevoucherID = PreVoucherID	
	 from [FIN].[ReceiptCheqeFlow]
	where [ReceiptCheqeFlowID] = @ReceiptCheqeFlowID

	if @Version <> @PreVersion
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)
	
	declare @PreDate date,@PreType tinyint,@PreBankAccountID int = null,@PreCashID int = null,
	@MaxDate date,@Title nvarchar(256),@id int,@itemId int,@amount decimal(30,4),@s bit = 0,
	@SumAmount decimal(30, 4),@LastAmount decimal(30, 4),@Message NVARCHAR(MAX)

	SELECT @PreDate = [Date],
		    @PreType = [Type],
			@PreBankAccountID = BankAccountID,
			@PreCashID = CashID
	FROM FIN.ReceiptCheqeFlow 
	WHERE ReceiptCheqeFlowID = @ReceiptCheqeFlowID

	if (@PreType <> @Type)
	begin
		if (@PreType = 2)
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
	end
	else 
	begin
		if (@Type = 2)
		begin
			if (@PreBankAccountID <> @BankAccountID)
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
			else if (@PreDate <> @Date)
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
	end

	if (@PreType = 5)
	begin
		if (@PreType <> @Type or @PreDate <> @Date)
		begin
			select r.BankAccountID,sum(r.Amount) Amount 
			into #rcfi
			from FIN.ReceiptCheqeFlowItem i
			join (select i2.ReceiptCheqeFlowItemID,f.BankAccountID,c.Amount
					from FIN.ReceiptCheqeFlowItem i2 
					join FIN.ReceiptCheqeFlow f on i2.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
					join FIN.ReceivedCheqe c on i2.ReceivedCheqeID = c.ReceivedCheqeID
					where i2.[State] = 1) r on r.ReceiptCheqeFlowItemID = i.PreviousFlow
			where i.ReceiptCheqeFlowID = @ReceiptCheqeFlowID and i.[State] = 6
			group by r.BankAccountID

			set @s = 0
			while (@s = 0 and (select count(*) from #rcfi) > 0)
			begin
				select top(1) @id = BankAccountID,@amount = Amount from #rcfi
				delete from #rcfi where BankAccountID = @id
				select @MaxDate = MAX(r.[Date]) from FIN.Reconciliation r where r.BankAccountID = @id 
				if (@Date <= @MaxDate)
					set @s = 1
			end
			drop table #rcfi
			if(@s = 1)
			begin
				select @Title = d.Title from CFG.BankAccount b
				join ACC.DL d on b.DlID = d.DLID
				where b.BankAccountID = @id
					
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				return
			end
		end
	end

	IF (LOWER((select f.ConfigValue from CFG.Configuration f
		where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true' or
		LOWER((select f.ConfigValue from CFG.Configuration f
		where f.ConfigKey = 'CashNegativeStoreControl')) = 'true')
	begin
		if (@PreType <> @Type or (@Type = 2 and @PreBankAccountID <> @BankAccountID) or 
			(@Type = 3 and @PreCashID <> @CashID))
		begin

			if (@PreType = 2)
			begin
				select @LastAmount = LastAmount from CFG.BankAccount_LastAmount where BankAccountID = @PreBankAccountID

				select @SumAmount = sum(c.Amount) from FIN.ReceiptCheqeFlowItem i
				join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
				where ReceiptCheqeFlowID = @ReceiptCheqeFlowID

				if ((@LastAmount - @SumAmount) < 0) 
				begin

					SELECT @Title = d.Title FROM CFG.BankAccount ba
				    JOIN ACC.DL d ON ba.DlID = d.DLID
				    WHERE ba.BankAccountID = @PreBankAccountID

					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusBankAccount'
					AND lsv.Culture = cfg.GetuserCulture()
					SET @Message = REPLACE(@Message, '{0}', @Title)	

					raiserror(@Message,16,12)
					return

				end
			end

			if (@PreType = 3)
			begin
				select c.CurrencyID,sum(c.Amount) Amount
				into #flowItemTemp
				from FIN.ReceiptCheqeFlowItem i
				join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
				where i.ReceiptCheqeFlowID = @ReceiptCheqeFlowID 
				group by c.CurrencyID 

				set @s = 0
				while(@s = 0 and (select count(*) from #flowItemTemp) > 0)
				begin
					select top(1) @id = CurrencyID,@amount = Amount from #flowItemTemp 
					delete from #flowItemTemp where CurrencyID = @id
					if ((select LastAmount from CFG.Cash_LastAmount where CashID = @PreCashID and CurrencyID = @id) < @amount)
					begin
						set @s = 1
						declare @CurrencyTitle nvarchar(256)
						select @Title = Title from CFG.Cash where CashID = @PreCashID
						select @CurrencyTitle = Title from CFG.Currency where CurrencyID = @id
					end						
				end
				drop table #flowItemTemp
				if (@s = 1)
				begin
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusCash'
					AND lsv.Culture = cfg.GetuserCulture()
					SET @Message = REPLACE(@Message, '{0}', @Title)
					SET @Message = REPLACE(@Message, '{1}', @CurrencyTitle)
							
					raiserror(@Message,16,12)
					return
				end
			end
		end


		if (@PreType = 5 and (@PreType <> @Type))
		begin
			select r.BankAccountID,sum(r.Amount) Amount
			into #rcfi2
			from FIN.ReceiptCheqeFlowItem i
			join (select i2.ReceiptCheqeFlowItemID,f.BankAccountID,c.Amount from FIN.ReceiptCheqeFlowItem i2 
				    join FIN.ReceiptCheqeFlow f on i2.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
					join FIN.ReceivedCheqe c on i2.ReceivedCheqeID = c.ReceivedCheqeID
					where i2.State = 1) r on r.ReceiptCheqeFlowItemID = i.PreviousFlow
			where i.ReceiptCheqeFlowID = @ReceiptCheqeFlowID and i.State = 6
			group by r.BankAccountID
				
			set @s = 0
			while(@s = 0 and (select count(*) from #rcfi2) > 0)
			begin
				select top(1) @id = BankAccountID,@amount = Amount from #rcfi2
				delete from #rcfi2 where BankAccountID = @id
				if ((select la.LastAmount from CFG.BankAccount_LastAmount la where la.BankAccountID = @id) - @amount < 0) 
				begin
					set @s = 1	
					SELECT @Title = d.Title FROM CFG.BankAccount ba
					JOIN ACC.DL d ON ba.DlID = d.DLID
					WHERE ba.BankAccountID = @id
				end
			end
			drop table #rcfi2
			if (@s = 1)
			begin
				SELECT @Message = lsv.[Value]
				FROM cfg.LocalizationSQLMessage ls
				JOIN cfg.LocalizationSQLMessageValue lsv 
				ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
				WHERE ls.SQLMessageCode = 'MinusBankAccount'
				AND lsv.Culture = cfg.GetuserCulture()
				SET @Message = REPLACE(@Message, '{0}', @Title)	

				raiserror(@Message,16,12)
				return
			end
		end
	end
	
	UPDATE [FIN].[ReceiptCheqeFlow]
	SET     [Type] = @Type, 
			[BranchID] = @BranchID, 
			[Date] = @Date, 
			[Number] = @Number, 
			[BankAccountID] = @BankAccountID, 
			[CashID] = @CashID, 
			[PartyID] = @PartyID, 
			[Status] = @Status, 
			[InnerNumber] = @InnerNumber,
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [ReceiptCheqeFlowID] = @ReceiptCheqeFlowID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[ReceiptCheqeFlow]
	WHERE  [ReceiptCheqeFlowID] = @ReceiptCheqeFlowID	
	-- End Return Select <- do not remove
