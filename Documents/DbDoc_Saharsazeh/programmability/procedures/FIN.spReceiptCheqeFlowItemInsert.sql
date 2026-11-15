
---------------------------------------------  END #7640

------------------------------------- START #7908
CREATE   PROC [FIN].[spReceiptCheqeFlowItemInsert]     
    @ReceiptCheqeFlowID int,
    @RowIndex smallint,
    @PreviousFlow int,
    @ReceivedCheqeID int,
    @State tinyint,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	declare @Date date,
			@Type tinyint,
			@BankAccountID int = null,
			@ReceiptCheqeFlowItemID int

	select @Date = [Date],
	       @BankAccountID = BankAccountID,
		   @Type = [Type]
    from FIN.ReceiptCheqeFlow 
	where ReceiptCheqeFlowID = @ReceiptCheqeFlowID

	if (@PreviousFlow is null)
	begin
		select @PreviousFlow = LastFlow from FIN.ReceivedCheqe 
		where ReceivedCheqeID = @ReceivedCheqeID
	end

	if (@State = 6)
	begin
		select @BankAccountID = f.BankAccountID from FIN.ReceiptCheqeFlowItem i
		join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
		where i.ReceiptCheqeFlowItemID = @PreviousFlow and i.ReceivedCheqeID = @ReceivedCheqeID and i.[State] = 1
	end

	if exists (select * from (select ROW_NUMBER() OVER(PARTITION BY i.ReceivedCheqeID ORDER BY i.ReceiptCheqeFlowItemID desc) rno,i.ReceivedCheqeID,f.[Date]
					          from FIN.ReceiptCheqeFlowItem i
					          join fin.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID) T
			   where T.rno = 1 and
			         T.ReceivedCheqeID = @ReceivedCheqeID and 
			         T.[Date] > @Date)
	begin
		declare @Number nvarchar(100)
		select @Number = Number from fin.ReceivedCheqe where ReceivedCheqeID = @ReceivedCheqeID
		
		raiserror('چک شماره (%s) به تاریخ بعد از تاریخ مشخص شده گردش دارد.',16,12,@Number)
		return
	end
	
	if (@State = 4 or @State = 6)
	begin
		
		DECLARE @MaxDate date
		SELECT @MaxDate = MAX([Date]) FROM FIN.Reconciliation WHERE BankAccountID = @BankAccountID  
		
		IF (@Date <= @MaxDate)
		BEGIN
			
			DECLARE @Title nvarchar(256)
			
			SELECT @Title = d.Title FROM CFG.BankAccount b
			JOIN ACC.DL d on b.DlID = d.DLID
			WHERE b.BankAccountID = @BankAccountID
			
			RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
			return
		END
	
	end
	
	declare @LastState tinyint
	select @LastState = LastState from FIN.ReceivedCheqe where ReceivedCheqeID = @ReceivedCheqeID
    
    if (@State = @LastState)
    begin
		RAISERROR('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12) 
		return
    end

	if (@Type = 10)
	begin

		declare @Latest int = null
		select @Latest = PreviousFlow from fin.ReceiptCheqeFlowItem
		where ReceiptCheqeFlowItemID = @PreviousFlow and [State] = 1 and ReceivedCheqeID = @ReceivedCheqeID

		if (@Latest is null)
			set @State = 0

		if (@Latest is not null)
		begin
			declare @st tinyint
			select @st = [State] from fin.ReceiptCheqeFlowItem 
			where ReceiptCheqeFlowItemID = @Latest and ReceivedCheqeID = @ReceivedCheqeID

			set @State = @st
		end
	end
	
	INSERT INTO [FIN].[ReceiptCheqeFlowItem] ([ReceiptCheqeFlowID], [RowIndex], [PreviousFlow], [ReceivedCheqeID], [State], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ReceiptCheqeFlowID, @RowIndex, @PreviousFlow, @ReceivedCheqeID, @State, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	SELECT @ReceiptCheqeFlowItemID = SCOPE_IDENTITY()

	-- Begin Return Select <- do not remove
	SELECT [ReceiptCheqeFlowItemID], [Version], PreviousFlow, [State]
	FROM   [FIN].[ReceiptCheqeFlowItem]
	WHERE  [ReceiptCheqeFlowItemID] = @ReceiptCheqeFlowItemID
	-- End Return Select <- do not remove
	
	UPDATE [FIN].[ReceivedCheqe]
	SET    [LastState] = @State, [LastFlow] = @ReceiptCheqeFlowItemID
	WHERE  [ReceivedCheqeID] = @ReceivedCheqeID
