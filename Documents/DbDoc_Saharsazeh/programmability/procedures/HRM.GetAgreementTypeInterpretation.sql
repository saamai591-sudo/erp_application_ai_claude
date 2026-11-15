CREATE   PROCEDURE [HRM].[GetAgreementTypeInterpretation](@paymentSystemId INT, @AgreementTypeId tinyint)
--WITH ENCRYPTION
AS
	DECLARE @userId INT
	
	SET @userId=CFG.GetuserID()
	
	SELECT CASE WHEN  ati.AgreementTypeInterpretationID IS NULL
	THEN Cast(ROW_NUMBER() OVER (ORDER BY t.ParameterID) AS int)*-1  ELSE  
		ati.AgreementTypeInterpretationID END  AgreementTypeInterpretationID,
	       @AgreementTypeId     AgreementTypeID,
	       @paymentSystemId     PaymentSystemID,
	       T.ParameterID,
	       Cast(CASE 
	            WHEN ati.InterpretationType IS NULL THEN  0
	            ELSE ati.InterpretationType
	       END  AS TinyInt)                 InterpretationType,
	       CASE 
	            WHEN ati.Creator IS NULL THEN @userId
	            ELSE ati.Creator
	       END                  Creator,
	       CASE 
	            WHEN ati.CreationDate IS NULL THEN GETDATE()
	            ELSE ati.CreationDate
	       END                  CreationDate,
	       CASE 
	            WHEN ati.LastEditor IS NULL THEN @userId
	            ELSE ati.LastEditor
	       END                  LastEditor,
	       CASE 
	            WHEN ati.LastEditionDate IS NULL THEN GETDATE()
	            ELSE ati.LastEditionDate
	       END                  LastEditionDate,
	       CASE 
	            WHEN ati.Version IS NULL THEN 1
	            ELSE ati.Version
	       END                  Version,
	       T.Title AS ParamTitle
	FROM   (
	           SELECT *
	           FROM   pay.Parameter p
	           WHERE  p.ParameterTypeID = 4
	       )
	       T
	       INNER JOIN 
	       (
				SELECT DISTINCT pscm.ParameterID
				  FROM hrm.PaymentSystemCalculationMethod pscm
				WHERE pscm.PaymentSystemID=@paymentSystemId	
	       )TMethos
	       ON TMethos.ParameterID = T.ParameterID
	       LEFT JOIN (
	                SELECT *
	                FROM   hrm.AgreementTypeInterpretation
	                WHERE  hrm.AgreementTypeInterpretation.PaymentSystemID = @paymentSystemId
	                       AND hrm.AgreementTypeInterpretation.AgreementTypeID = 
	                           @AgreementTypeId
	            ) ati
	            ON  ati.ParameterID = T.ParameterID
