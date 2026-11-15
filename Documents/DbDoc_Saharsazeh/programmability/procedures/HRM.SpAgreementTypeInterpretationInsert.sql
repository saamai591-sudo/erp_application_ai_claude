CREATE PROC [HRM].[SpAgreementTypeInterpretationInsert] 
    @AgreementTypeID tinyint,
    @PaymentSystemID int,
    @ParameterID int,
    @InterpretationType tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
		
	INSERT INTO [HRM].[AgreementTypeInterpretation] ([AgreementTypeID], [PaymentSystemID], [ParameterID], [InterpretationType], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @AgreementTypeID, @PaymentSystemID, @ParameterID, @InterpretationType, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT	[AgreementTypeInterpretationID], 
			[Version]
	FROM   [HRM].[AgreementTypeInterpretation]
	WHERE  [AgreementTypeInterpretationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
