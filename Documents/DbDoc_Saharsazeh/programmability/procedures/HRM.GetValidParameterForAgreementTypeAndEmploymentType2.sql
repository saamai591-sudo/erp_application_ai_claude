------------------------------------- END #7070

------------------------------------- START #6888
CREATE   PROCEDURE [HRM].[GetValidParameterForAgreementTypeAndEmploymentType2](
	@AgreementTypeId      TINYINT,
	@EmploymentTypeId     INT,
	@PersonelID           INT
)
--WITH ENCRYPTION
AS
	DECLARE @AggID int

	SELECT TOP 1 @AggID = a.AgreementID
	FROM   hrm.Agreement a
	WHERE  a.PersonelID = @personelID
	ORDER BY
		   a.IssueDate DESC
	
	SELECT ati.ParameterID,
		p.ParameterTypeID ,
		CASE ati.InterpretationType
			WHEN 0 THEN T.Amount
			WHEN 1 THEN NULL
			WHEN 2 THEN NULL
			WHEN 3 THEN T.Amount
			WHEN 4 THEN T.Amount
		END AS Amount,
		ati.InterpretationType,
		p.Title AS ParameterName
	FROM hrm.AgreementTypeInterpretation ati
		INNER JOIN hrm.EmploymentType et
			ON et.PaymentSystemID = ati.PaymentSystemID
		INNER JOIN pay.Parameter p
			ON p.ParameterID = ati.ParameterID
		LEFT JOIN (
			SELECT * FROM hrm.AgreementParameter ap
			WHERE ap.AgreementID=@AggID	
		)T
			ON T.ParameterID=P.ParameterID 
	WHERE ati.AgreementTypeID=@AgreementTypeId
		AND et.EmploymentTypeID=@EmploymentTypeId;
