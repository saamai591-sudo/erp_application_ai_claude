
---------------------------------------------------------
CREATE    PROC [STC].SpReturnedOutgoingItemInsert
	@ReturnedOutgoingID int,
	@RowIndex smallint,
	@OutgoingItemID int = NULL,
	@StuffID int,
	@MainQuantity decimal(36,10),
	@SubQuantity decimal(36,10) = NULL,
	@Fee decimal(36,10),
	@Price decimal(36,10),
	@Description nvarchar(250) = NULL,
	@Description2 nvarchar(250) = NULL,
	@Creator int,
	@CreationDate datetime,
	@ReturnedSaleInvoiceItemID int,
	@ReturnedSaleJustificationItemID int
	
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	declare @Message nvarchar(max),
			@StuffCode nvarchar(max)
	
	INSERT INTO [STC].[ReturnedOutgoingItem] ([ReturnedOutgoingID], [RowIndex], [OutgoingItemID], [StuffID], [MainQuantity], [SubQuantity], [Fee], [Price], [Description], [Description2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[ReturnedSaleInvoiceItemID],[ReturnedSaleJustificationItemID])
	SELECT @ReturnedOutgoingID, @RowIndex, @OutgoingItemID, @StuffID, @MainQuantity, @SubQuantity, @Fee, @Price, @Description, @Description2, 0, @Creator, @CreationDate, @Creator, @CreationDate, @ReturnedSaleInvoiceItemID, @ReturnedSaleJustificationItemID
	
	if @OutgoingItemID is not null
	begin

	if exists (select * from ast.Creation where OutgoingItemID = @OutgoingItemID)
			RAISERROR('این حواله ثبت دارایی شده است. مجاز به برگشت آن نیستید.',16,12)


			IF (SELECT Non FROM  SLE.Outgoing_Return_Remain
				WHERE OutgoingItemID = @OutgoingItemID)<0
				OR
			 (SELECT NonSub FROM  SLE.Outgoing_Return_Remain
				WHERE OutgoingItemID = @OutgoingItemID)<0	
			
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusOutgoing'
					AND lsv.Culture = cfg.GetuserCulture()
				
					SELECT @StuffCode = Code
						FROM   [STF].[Stuff]
						WHERE  StuffID = @StuffID
						
							SET @Message = REPLACE(@Message, '{0}', @StuffCode)
							RAISERROR(@Message,16,12)
				
					--RAISERROR('مقدار اصلي نمي تواند بيشتر از حواله مبنا باشد.',16,12)
				END

	end
	-- Begin Return Select <- do not remove
	SELECT [ReturnedOutgoingItemID], [Version]
	FROM   [STC].[ReturnedOutgoingItem]
	WHERE  [ReturnedOutgoingItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
