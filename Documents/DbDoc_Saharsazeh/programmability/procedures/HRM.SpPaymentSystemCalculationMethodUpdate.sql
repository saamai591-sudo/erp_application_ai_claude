CREATE PROC [HRM].[SpPaymentSystemCalculationMethodUpdate] 
    @PaymentSystemCalculationMethodID int,
    @ParameterID int = NULL,
    @PaymentSystemID int = NULL,
    @EfficientCalendarMonthID int,
    @GenerateCalendarMonthID int,
    @ConfirmationFormID tinyint = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [HRM].[PaymentSystemCalculationMethod]
				where [PaymentSystemCalculationMethodID] = @PaymentSystemCalculationMethodID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	declare @OldCalendarMonthId int,@OldPaymentSystemId int

	select @OldCalendarMonthId=GenerateCalendarMonthID,@OldPaymentSystemId=PaymentSystemId from hrm.PaymentSystemCalculationMethod
	where PaymentSystemCalculationMethodID=@PaymentSystemCalculationMethodID

	IF @ParameterID IS NOT NULL AND hrm.HasAgreementAfter(@OldCalendarMonthId,@OldPaymentSystemId)=1
	begin
		RAISERROR('با توجه به اينکه از اين روش محاسبه استفاده شده است امکان ويرايش  آن نمي باشد.',16,12)
		return
	end
	if @ParameterID IS NOT NULL AND hrm.HasAgreementAfter(@GenerateCalendarMonthID,@PaymentSystemId)=1
	begin
		RAISERROR('با توجه به اينکه بعد  از اين تاريخ قرارداد صادر شده است امکان ثبت نوع محاسبه جديد نمي باشد.',16,12)
		return
	end

	set @Version = @Version +1 

	UPDATE [HRM].[PaymentSystemCalculationMethod]
	SET    [ParameterID] = @ParameterID, [PaymentSystemID] = @PaymentSystemID, [EfficientCalendarMonthID] = @EfficientCalendarMonthID, [GenerateCalendarMonthID] = @GenerateCalendarMonthID, [ConfirmationFormID] = @ConfirmationFormID, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [PaymentSystemCalculationMethodID] = @PaymentSystemCalculationMethodID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[PaymentSystemCalculationMethod]
	WHERE  [PaymentSystemCalculationMethodID] = @PaymentSystemCalculationMethodID	
	-- End Return Select <- do not remove
