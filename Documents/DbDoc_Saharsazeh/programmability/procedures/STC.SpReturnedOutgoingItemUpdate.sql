------------------------------------------------------------------
CREATE   PROC [STC].SpReturnedOutgoingItemUpdate
	@ReturnedOutgoingItemID int,
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
	@Version int,
	@LastEditor int,
	@LastEditionDate datetime,
	@ReturnedSaleInvoiceItemID int,
	@ReturnedSaleJustificationItemID int
--WITH ENCRYPTION 
AS 

	SET NOCOUNT ON 

	DECLARE @PreVersion INT,
			@PrePrevoucher INT,
			@Message NVARCHAR(MAX),
			@PreOutgoingItemID int,
			@StuffCode NVARCHAR(256) ,
			@PreviousMainQuantity DECIMAL(30,4),
			@PreviousSubQuantity DECIMAL(30,4)
			
	Select @PreVersion = A.[Version] ,
		   @PrePrevoucher = ro.PreVoucherID	   ,
		   @PreOutgoingItemID = OutgoingItemID	,
		   @PreviousMainQuantity = MainQuantity,
		   @PreviousSubQuantity = SubQuantity 
	from [STC].[ReturnedOutgoingItem] A
	JOIN stc.ReturnedOutgoing ro ON A.ReturnedOutgoingID = ro.ReturnedOutgoingID
	where [ReturnedOutgoingItemID] = @ReturnedOutgoingItemID
	
	if @Version <> @PreVersion
	or @PrePrevoucher is not null	
	begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end


			set @Version = @Version +1 

		UPDATE [STC].[ReturnedOutgoingItem]
		SET     [RowIndex] = @RowIndex, 
				[OutgoingItemID] = @OutgoingItemID, 
				[StuffID] = @StuffID, 
				[MainQuantity] = @MainQuantity, 
				[SubQuantity] = @SubQuantity, 
				[Fee] = @Fee, 
				[Price] = @Price, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate,
				ReturnedSaleInvoiceItemID = @ReturnedSaleInvoiceItemID,
				ReturnedSaleJustificationItemID = @ReturnedSaleJustificationItemID
		WHERE  [ReturnedOutgoingItemID] = @ReturnedOutgoingItemID
	

		IF @OutgoingItemID IS NOT NULL	
	BEGIN

		if exists (select * from ast.Creation where OutgoingItemID = @OutgoingItemID)
			RAISERROR('این حواله ثبت دارایی شده است. مجاز به برگشت آن نیستید.',16,12)

				
		IF (SELECT Non FROM  SLE.Outgoing_Return_Remain
			WHERE OutgoingItemID = @OutgoingItemID)<0
			OR
		 (SELECT  NonSub FROM  SLE.Outgoing_Return_Remain
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
	END

		-- Begin Return Select <- do not remove
		SELECT  [Version] 
		FROM   [STC].[ReturnedOutgoingItem]
		WHERE  [ReturnedOutgoingItemID] = @ReturnedOutgoingItemID	
		-- End Return Select <- do not remove
;
