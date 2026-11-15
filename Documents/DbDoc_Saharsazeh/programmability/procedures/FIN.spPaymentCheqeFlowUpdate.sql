CREATE   PROC [FIN].[spPaymentCheqeFlowUpdate] 
    @PaymentCheqeFlowID int,
    @FinancialPeriodID int,
    @Type tinyint,
    @BranchID int,
    @Date date,
    @BankAccountID int,
    @PartyID bigint,
    @PreVoucherID int,
    @InnerNumber int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	DECLARE @prePrevoucherID INT,
			@PreVersion INT
	
	Select  @PreVersion = [Version] ,
			@prePrevoucherID = PreVoucherID
	from [FIN].[PaymentCheqeFlow]
	where [PaymentCheqeFlowID] = @PaymentCheqeFlowID
	
	if @Version <> @PreVersion
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)	
	
		declare @PreDate date
		select @PreDate = [Date] from FIN.PaymentCheqeFlow where PaymentCheqeFlowID = @PaymentCheqeFlowID
		
		if (@PreDate <> @Date)
		begin
			declare @MaxDate date,@Title nvarchar(256)
			if (@Type = 0)
			begin
			
				select @MaxDate = MAX(r.[Date]) from FIN.Reconciliation r where r.BankAccountID = @BankAccountID  
				if (@Date <= @MaxDate)
				begin
				
					select @Title = d.Title from CFG.BankAccount b
					join ACC.DL d on b.DlID = d.DLID
					where b.BankAccountID = @BankAccountID
					
					RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
					return
				end
			end
			
			if (@Type = 1)
			begin

				select c.BankAccountID,p.RowIndex 
				into #acc
				from FIN.PaymentCheqeFlowItem p
				join FIN.PaymentCheqe c on p.PaymentCheqeID = c.PaymentCheqeID
				join FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
				where p.PaymentCheqeFlowID = @PaymentCheqeFlowID and t.Today = 1

				if((select count(*) from #acc) > 0)
				begin
					declare @id int,@s bit = 0
					while @s = 0 and (select count(*) from #acc) > 0
					begin
						select @id = c.BankAccountID from #acc c where c.RowIndex = (select MIN(RowIndex) from #acc)
						select @MaxDate = MAX(r.[Date]) from FIN.Reconciliation r where r.BankAccountID = @id 
						delete from #acc where BankAccountID = @id
						if (@Date <= @MaxDate)
							set @s = 1
					end

					if(@s = 1)
					begin
						drop table #acc
						select @Title = d.Title from CFG.BankAccount b
						join ACC.DL d on b.DlID = d.DLID
						where b.BankAccountID = @id
					
						RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
						return
					end
				end
				IF OBJECT_ID('tempdb..#acc') IS Not NULL
					drop table #acc
			end
		end
	
		UPDATE [FIN].[PaymentCheqeFlow]
		SET     [Type] = @Type, 
				[BranchID] = @BranchID, 
				[Date] = @Date, 
				[BankAccountID] = @BankAccountID, 
				[PartyID] = @PartyID, 
				[InnerNumber] = @InnerNumber,
				[Version] = @Version + 1, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [PaymentCheqeFlowID] = @PaymentCheqeFlowID
	
		-- Begin Return Select <- do not remove
		SELECT	[Version],
				[InnerNumber]
		FROM   [FIN].[PaymentCheqeFlow]
		WHERE  [PaymentCheqeFlowID] = @PaymentCheqeFlowID	
		-- End Return Select <- do not remove
