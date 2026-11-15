CREATE PROC [HRM].[SpPaymentSystemCalculationMethodInsert] 
    @ParameterID int = NULL,
    @PaymentSystemID int = NULL,
    @EfficientCalendarMonthID int,
    @GenerateCalendarMonthID int,
    @ConfirmationFormID tinyint = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	IF @PaymentSystemID IS NOT NULL AND hrm.HasAgreementAfter(@GenerateCalendarMonthID,@PaymentSystemId)=1
	begin
		RAISERROR('با توجه به اينکه بعد  از اين تاريخ قرارداد صادر شده است امکان ثبت نوع محاسبه جديد نمي باشد.',16,12)
		return
	end
	
	INSERT INTO [HRM].[PaymentSystemCalculationMethod] ([ParameterID], [PaymentSystemID], [EfficientCalendarMonthID], [GenerateCalendarMonthID], [ConfirmationFormID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @ParameterID, @PaymentSystemID, @EfficientCalendarMonthID, @GenerateCalendarMonthID, @ConfirmationFormID, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT	[PaymentSystemCalculationMethodID], 
			[Version]
	FROM   [HRM].[PaymentSystemCalculationMethod]
	WHERE  [PaymentSystemCalculationMethodID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
