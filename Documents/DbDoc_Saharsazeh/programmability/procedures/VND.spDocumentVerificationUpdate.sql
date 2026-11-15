CREATE     PROC [VND].[spDocumentVerificationUpdate] 
    @DocumentVerificationID INT,
	@Number int  ,
	@Date Date  ,
	@BaseType tinyint  ,
	@BaseID int  ,
	@DocumentVerificationPathItemID int  ,
	@Description nvarchar(max)  ,
	@Description2 nvarchar(max)  ,
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
	SET NOCOUNT ON 
	
	IF @Version=(SELECT [Version] FROM [VND].[DocumentVerification]
	WHERE [DocumentVerificationID] = @DocumentVerificationID)
	BEGIN	

		SET @Version = @Version +1 

		UPDATE [VND].[DocumentVerification]
		SET     Number = @Number, 
				Date = @Date, 
				BaseType = @BaseType,
				BaseID = @BaseID,
				DocumentVerificationPathItemID = @DocumentVerificationPathItemID,
				Description = @Description,
				Description2 = @Description2,
				[Version] = @Version,  
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  [DocumentVerificationID] = @DocumentVerificationID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [VND].[DocumentVerification]
		WHERE  [DocumentVerificationID] = @DocumentVerificationID	
		-- End Return Select <- do not remove

	END
